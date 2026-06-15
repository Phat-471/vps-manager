<?php
/**
 * BẢNG ĐIỀU KHIỂN THỐNG KÊ CÀI ĐẶT & GIÁM SÁT VPS TẬP TRUNG
 */
session_start();
date_default_timezone_set('Asia/Ho_Chi_Minh');

// ==========================================
// CẤU HÌNH MẬT KHẨU TRUY CẬP (HÃY THAY ĐỔI)
// ==========================================
$ADMIN_PASSWORD = 'admin'; // Quyền tối cao: Xem mật khẩu, tải credentials, xóa lịch sử
$STAFF_PASSWORD = 'staff'; // Quyền giám sát: Chỉ xem biểu đồ và trạng thái, ẩn mật khẩu

$data_dir = __DIR__ . '/data';
$db_file = $data_dir . '/installations.json';
$audit_file = $data_dir . '/audit_logs.json';

// Đảm bảo thư mục tồn tại
if (!is_dir($data_dir)) {
    mkdir($data_dir, 0755, true);
}

// Hàm ghi Audit Log
function log_activity($username, $action, $details) {
    global $audit_file;
    $logs = [];
    if (file_exists($audit_file)) {
        $logs = json_decode(file_get_contents($audit_file), true) ?: [];
    }
    array_unshift($logs, [
        'timestamp' => date('Y-m-d H:i:s'),
        'username' => $username,
        'action' => $action,
        'details' => $details,
        'ip' => $_SERVER['REMOTE_ADDR']
    ]);
    if (count($logs) > 50) {
        $logs = array_slice($logs, 0, 50); // Giới hạn 50 hoạt động gần nhất
    }
    file_put_contents($audit_file, json_encode($logs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// Xử lý Đăng xuất
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    $user = $_SESSION['vps_user'] ?? 'Ẩn danh';
    log_activity($user, 'Đăng xuất', 'Đăng xuất khỏi bảng thống kê');
    session_destroy();
    header('Location: stats.php');
    exit;
}

// Xử lý Đăng nhập
$login_error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login_submit'])) {
    $password = $_POST['password'] ?? '';
    if ($password === $ADMIN_PASSWORD) {
        $_SESSION['vps_authenticated'] = true;
        $_SESSION['vps_role'] = 'admin';
        $_SESSION['vps_user'] = 'Administrator';
        log_activity('Administrator', 'Đăng nhập', 'Đăng nhập quyền Admin thành công');
        header('Location: stats.php');
        exit;
    } elseif ($password === $STAFF_PASSWORD) {
        $_SESSION['vps_authenticated'] = true;
        $_SESSION['vps_role'] = 'staff';
        $_SESSION['vps_user'] = 'Staff Member';
        log_activity('Staff Member', 'Đăng nhập', 'Đăng nhập quyền Nhân viên giám sát thành công');
        header('Location: stats.php');
        exit;
    } else {
        $login_error = 'Mật khẩu đăng nhập không chính xác!';
        log_activity('Ẩn danh', 'Đăng nhập thất bại', 'Thử mật khẩu sai từ IP: ' . $_SERVER['REMOTE_ADDR']);
    }
}

// Kiểm tra xác thực
$authenticated = $_SESSION['vps_authenticated'] ?? false;
$role = $_SESSION['vps_role'] ?? 'none';
$username = $_SESSION['vps_user'] ?? '';

// Xử lý Yêu cầu AJAX (Nếu đã đăng nhập)
if ($authenticated) {
    // 1. Xem nhật ký thao tác
    if (isset($_GET['api']) && $_GET['api'] === 'audit') {
        header('Content-Type: application/json');
        $logs = [];
        if (file_exists($audit_file)) {
            $logs = json_decode(file_get_contents($audit_file), true) ?: [];
        }
        echo json_encode($logs);
        exit;
    }
    
    // 2. Lấy dữ liệu chi tiết Resource Stats của một VPS cụ thể
    if (isset($_GET['api']) && $_GET['api'] === 'stats' && !empty($_GET['ip'])) {
        header('Content-Type: application/json');
        $safe_ip = preg_replace('/[^a-zA-Z0-9_.-]/', '', $_GET['ip']);
        $stats_file = $data_dir . '/stats/' . $safe_ip . '.json';
        if (file_exists($stats_file)) {
            echo file_get_contents($stats_file);
        } else {
            echo json_encode([]);
        }
        exit;
    }

    // 3. Xóa một lượt cài đặt
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action_delete']) && !empty($_POST['vps_id'])) {
        if ($role !== 'admin') {
            die('Không có quyền thực hiện.');
        }
        $vps_id = $_POST['vps_id'];
        if (file_exists($db_file)) {
            $list = json_decode(file_get_contents($db_file), true) ?: [];
            $new_list = [];
            $deleted_ip = 'Không rõ';
            foreach ($list as $item) {
                if ($item['id'] === $vps_id) {
                    $deleted_ip = $item['ip'];
                } else {
                    $new_list[] = $item;
                }
            }
            file_put_contents($db_file, json_encode($new_list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            log_activity($username, 'Xóa VPS', 'Xóa bản ghi VPS IP: ' . $deleted_ip);
        }
        header('Location: stats.php');
        exit;
    }
    
    // 4. Báo cáo khi ghi nhận nhấp xem hoặc tải mật khẩu
    if (isset($_GET['api']) && $_GET['api'] === 'log_download' && !empty($_GET['ip'])) {
        header('Content-Type: application/json');
        log_activity($username, 'Tải thông tin', 'Tải tệp tin cấu hình VPS IP: ' . $_GET['ip']);
        echo json_encode(['success' => true]);
        exit;
    }
}

// Đọc danh sách cài đặt
$installations = [];
if (file_exists($db_file)) {
    $installations = json_decode(file_get_contents($db_file), true) ?: [];
}

// Phân tích trạng thái cài đặt để hiển thị KPI
$kpi = [
    'total' => count($installations),
    'success' => 0,
    'installing' => 0,
    'failed' => 0
];
foreach ($installations as $inst) {
    $status = $inst['status'] ?? 'unknown';
    if ($status === 'success') $kpi['success']++;
    elseif ($status === 'installing') $kpi['installing']++;
    elseif ($status === 'failed') $kpi['failed']++;
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VPS Manager - Thống Kê & Giám Sát Cài Đặt</title>
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <!-- Chart.js CDN -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --bg-dark: #070913;
            --bg-card: rgba(16, 20, 38, 0.5);
            --border-glass: rgba(255, 255, 255, 0.08);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --primary: #6366f1;
            --primary-glow: rgba(99, 102, 241, 0.15);
            --success: #10b981;
            --success-glow: rgba(16, 185, 129, 0.1);
            --danger: #ef4444;
            --danger-glow: rgba(239, 68, 68, 0.1);
            --warning: #f59e0b;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-dark);
            color: var(--text-primary);
            min-height: 100vh;
            line-height: 1.5;
            position: relative;
            overflow-x: hidden;
        }

        /* Ambient background lights */
        body::before {
            content: '';
            position: absolute;
            top: -150px;
            left: 10%;
            width: 500px;
            height: 500px;
            background: radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%);
            z-index: -1;
            pointer-events: none;
        }

        body::after {
            content: '';
            position: absolute;
            bottom: 50px;
            right: 5%;
            width: 550px;
            height: 550px;
            background: radial-gradient(circle, rgba(168, 85, 247, 0.06) 0%, transparent 70%);
            z-index: -1;
            pointer-events: none;
        }

        .container {
            width: 100%;
            max-width: 1280px;
            margin: 0 auto;
            padding: 24px;
        }

        /* Glassmorphism Card Style */
        .card-glass {
            background: var(--bg-card);
            border: 1px solid var(--border-glass);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-radius: 16px;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
        }

        /* Lock Screen CSS */
        .lock-container {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }

        .lock-card {
            width: 100%;
            max-width: 400px;
            padding: 32px;
            text-align: center;
        }

        .lock-icon {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            background: rgba(99, 102, 241, 0.1);
            border: 1px solid rgba(99, 102, 241, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            color: var(--primary);
            box-shadow: 0 0 20px rgba(99, 102, 241, 0.15);
        }

        .lock-title {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }

        .lock-subtitle {
            font-size: 14px;
            color: var(--text-secondary);
            margin-bottom: 24px;
        }

        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }

        label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: #cbd5e1;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 8px;
        }

        .input-glass {
            width: 100%;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border-glass);
            border-radius: 10px;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 14px;
            transition: all 0.2s ease;
        }

        .input-glass:focus {
            outline: none;
            border-color: var(--primary);
            background: rgba(255, 255, 255, 0.08);
            box-shadow: 0 0 12px rgba(99, 102, 241, 0.2);
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 10px 20px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
            font-family: inherit;
            gap: 8px;
        }

        .btn-primary {
            background: var(--primary);
            color: white;
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
        }

        .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
            background: #4f46e5;
        }

        .btn-glass {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-glass);
            color: var(--text-primary);
        }

        .btn-glass:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.15);
        }

        .btn-block {
            width: 100%;
        }

        .alert-error {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 8px;
            padding: 12px;
            color: var(--danger);
            font-size: 13px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        /* Header Layout */
        header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 32px;
            padding-bottom: 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .header-title h1 {
            font-size: 26px;
            font-weight: 700;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, #fff 30%, var(--primary) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .header-title p {
            font-size: 13px;
            color: var(--text-secondary);
            margin-top: 4px;
        }

        .user-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border-glass);
            padding: 6px 14px;
            border-radius: 30px;
            font-size: 12px;
        }

        .role-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }
        .role-admin { background: var(--success); box-shadow: 0 0 10px var(--success); }
        .role-staff { background: var(--warning); box-shadow: 0 0 10px var(--warning); }

        /* Stats Grid Cards */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 28px;
        }

        .stat-card {
            padding: 20px;
            display: flex;
            align-items: center;
            gap: 16px;
            overflow: hidden;
            position: relative;
        }

        .stat-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .stat-details h4 {
            font-size: 24px;
            font-weight: 700;
        }

        .stat-details p {
            font-size: 12px;
            color: var(--text-secondary);
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* Command Box */
        .cmd-box {
            padding: 20px;
            margin-bottom: 28px;
            border-left: 4px solid var(--primary);
        }

        .cmd-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 10px;
            color: var(--text-primary);
        }

        .cmd-input-container {
            display: flex;
            gap: 10px;
        }

        .cmd-code {
            flex: 1;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            padding: 12px;
            font-family: monospace;
            font-size: 13px;
            color: #38bdf8;
            overflow-x: auto;
            white-space: nowrap;
            display: flex;
            align-items: center;
        }

        /* Lists Table */
        .table-card {
            overflow: hidden;
            margin-bottom: 28px;
        }

        .table-header {
            padding: 20px;
            border-bottom: 1px solid var(--border-glass);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .table-header h3 {
            font-size: 16px;
            font-weight: 600;
        }

        .table-wrapper {
            overflow-x: auto;
            width: 100%;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            font-size: 14px;
        }

        th {
            background: rgba(255, 255, 255, 0.02);
            padding: 14px 20px;
            color: var(--text-secondary);
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid var(--border-glass);
        }

        td {
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            vertical-align: middle;
        }

        tr:hover td {
            background: rgba(255, 255, 255, 0.01);
        }

        .badge {
            display: inline-flex;
            align-items: center;
            padding: 4px 8px;
            border-radius: 30px;
            font-size: 11px;
            font-weight: 600;
        }
        
        .badge-installing {
            background: rgba(59, 130, 246, 0.1);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.15);
            animation: pulse-badge 1.8s infinite;
        }
        
        .badge-success {
            background: var(--success-glow);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.15);
        }
        
        .badge-failed {
            background: var(--danger-glow);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.15);
        }

        @keyframes pulse-badge {
            0% { opacity: 0.7; }
            50% { opacity: 1; }
            100% { opacity: 0.7; }
        }

        .mask-pwd {
            font-family: monospace;
            background: rgba(255, 255, 255, 0.04);
            padding: 4px 8px;
            border-radius: 6px;
            border: 1px solid var(--border-glass);
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .btn-icon {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            transition: color 0.2s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        .btn-icon:hover {
            color: var(--text-primary);
        }

        .action-cell {
            display: flex;
            gap: 8px;
        }

        /* Sparkline charts placeholder */
        .sparkline {
            width: 80px;
            height: 30px;
            display: inline-block;
            vertical-align: middle;
        }

        /* Audits logs list */
        .audit-logs-card {
            padding: 20px;
        }

        .audit-list {
            margin-top: 15px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-height: 250px;
            overflow-y: auto;
            padding-right: 5px;
        }

        .audit-item {
            padding: 10px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.04);
            border-radius: 8px;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .audit-time {
            color: #a5b4fc;
            font-family: monospace;
        }

        /* VPS Detail Drawer Modal */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 100;
            padding: 20px;
        }

        .modal-card {
            width: 100%;
            max-width: 750px;
            max-height: 90vh;
            overflow-y: auto;
            padding: 24px;
        }

        .modal-header-flex {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 1px solid var(--border-glass);
            padding-bottom: 14px;
        }

        .modal-close {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 20px;
        }

        .chart-box {
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid var(--border-glass);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 16px;
        }

        .chart-container {
            position: relative;
            height: 250px;
            width: 100%;
        }

        .vps-details-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 20px;
        }

        .vps-detail-item {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.04);
            border-radius: 8px;
            padding: 10px 14px;
            font-size: 13px;
        }

        .vps-detail-item span {
            color: var(--text-secondary);
            display: block;
            font-size: 11px;
            margin-bottom: 4px;
        }

        .vps-detail-item strong {
            color: var(--text-primary);
            font-family: monospace;
        }

        /* Utility classes */
        .flex-row-center {
            display: flex;
            align-items: center;
            gap: 8px;
        }
    </style>
</head>
<body>

<?php if (!$authenticated): ?>
    <!-- LOCK SCREEN (LOGIN FORM) -->
    <div class="lock-container">
        <div class="lock-card card-glass">
            <div class="lock-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <h2 class="lock-title">VPS Manager</h2>
            <p class="lock-subtitle">Bảng Thống Kê & Giám Sát Cài Đặt</p>

            <?php if (!empty($login_error)): ?>
                <div class="alert-error">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <span><?php echo $login_error; ?></span>
                </div>
            <?php endif; ?>

            <form method="POST">
                <div class="form-group">
                    <label for="password">Mật khẩu truy cập</label>
                    <input type="password" name="password" id="password" required class="input-glass" placeholder="Nhập mật khẩu truy cập..." autofocus>
                </div>
                <button type="submit" name="login_submit" class="btn btn-primary btn-block">Đăng nhập</button>
            </form>
        </div>
    </div>
<?php else: ?>
    <!-- DASHBOARD VIEW -->
    <div class="container">
        <!-- Header -->
        <header>
            <div class="header-title">
                <h1>BẢNG ĐIỀU KHIỂN TẬP TRUNG</h1>
                <p>Quản lý cài đặt, theo dõi băng thông & hoạt động các máy chủ VPS</p>
            </div>
            <div class="flex-row-center">
                <div class="user-badge">
                    <span class="role-indicator <?php echo $role === 'admin' ? 'role-admin' : 'role-staff'; ?>"></span>
                    <strong><?php echo htmlspecialchars($username); ?></strong>
                    <span style="color: var(--text-secondary); font-size: 11px;">(<?php echo strtoupper($role); ?>)</span>
                </div>
                <a href="stats.php?action=logout" class="btn btn-glass" style="padding: 6px 14px; font-size: 12px; text-decoration: none;">Đăng xuất</a>
            </div>
        </header>

        <!-- KPI Grid Cards -->
        <div class="stats-grid">
            <div class="stat-card card-glass">
                <div class="stat-icon" style="background: rgba(99, 102, 241, 0.1); color: var(--primary);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
                </div>
                <div class="stat-details">
                    <h4><?php echo $kpi['total']; ?></h4>
                    <p>Tổng số VPS cài đặt</p>
                </div>
            </div>
            <div class="stat-card card-glass">
                <div class="stat-icon" style="background: var(--success-glow); color: var(--success);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div class="stat-details">
                    <h4><?php echo $kpi['success']; ?></h4>
                    <p>Cài đặt thành công</p>
                </div>
            </div>
            <div class="stat-card card-glass">
                <div class="stat-icon" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
                </div>
                <div class="stat-details">
                    <h4><?php echo $kpi['installing']; ?></h4>
                    <p>Đang tiến hành cài</p>
                </div>
            </div>
            <div class="stat-card card-glass">
                <div class="stat-icon" style="background: var(--danger-glow); color: var(--danger);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                </div>
                <div class="stat-details">
                    <h4><?php echo $kpi['failed']; ?></h4>
                    <p>Cài đặt bị lỗi</p>
                </div>
            </div>
        </div>

        <!-- Command copy box -->
        <div class="cmd-box card-glass">
            <h4 class="cmd-title">Siêu liên kết cài đặt rút gọn nhanh cho VPS mới:</h4>
            <div class="cmd-input-container">
                <?php
                $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https" : "http";
                $install_url = $protocol . '://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['REQUEST_URI']);
                $install_url = rtrim($install_url, '/\\');
                $cmd_line = "curl -sSL " . $install_url . " | bash";
                ?>
                <div class="cmd-code" id="cmd-text"><?php echo htmlspecialchars($cmd_line); ?></div>
                <button class="btn btn-primary" onclick="copyText('cmd-text', 'Đã copy lệnh cài đặt!')">Copy lệnh</button>
            </div>
        </div>

        <!-- installations List Table -->
        <div class="table-card card-glass">
            <div class="table-header">
                <h3>Danh Sách Lịch Sử Cài Đặt VPS</h3>
                <span style="font-size: 11px; color: var(--text-secondary);">Nhấp vào IP bất kỳ để mở Biểu đồ giám sát tài nguyên</span>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>IP VPS</th>
                            <th>Hệ điều hành</th>
                            <th>Cổng</th>
                            <th>Mật khẩu truy cập</th>
                            <th>Trạng thái</th>
                            <th>Ngày cập nhật</th>
                            <th>Biểu đồ (24h)</th>
                            <th>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($installations)): ?>
                            <tr>
                                <td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 32px;">Không tìm thấy lịch sử cài đặt nào.</td>
                            </tr>
                        <?php else: ?>
                            <?php foreach (array_reverse($installations) as $inst): 
                                $status = $inst['status'] ?? 'unknown';
                                $ip = $inst['ip'] ?? '';
                                $inst_id = $inst['id'] ?? '';
                                $port = $inst['port'] ?? '';
                                $raw_pass = $inst['password'] ?? '';
                                $os_name = $inst['os'] ?? 'Linux OS';
                                $updated_at = $inst['updatedAt'] ?? '';
                                
                                // Tạo sparkline đơn giản dựa trên dữ liệu thật nếu có
                                $safe_ip = preg_replace('/[^a-zA-Z0-9_.-]/', '', $ip);
                                $stats_file = $data_dir . '/stats/' . $safe_ip . '.json';
                                $cpu_points = [];
                                if (file_exists($stats_file)) {
                                    $stats_data = json_decode(file_get_contents($stats_file), true) ?: [];
                                    $recent_stats = array_slice($stats_data, -10); // lấy 10 điểm gần nhất
                                    foreach ($recent_stats as $st) {
                                        $cpu_points[] = floatval($st['cpu'] ?? 0);
                                    }
                                }
                                ?>
                                <tr>
                                    <td>
                                        <a href="#" onclick="openVPSStats('<?php echo htmlspecialchars($ip); ?>', '<?php echo htmlspecialchars($os_name); ?>')" style="color: #60a5fa; font-weight: 600; text-decoration: none; border-bottom: 1px dashed rgba(96,165,250,0.4);">
                                            <?php echo htmlspecialchars($ip); ?>
                                        </a>
                                    </td>
                                    <td style="color: var(--text-secondary); font-size: 12px;"><?php echo htmlspecialchars($os_name); ?></td>
                                    <td style="font-family: monospace; font-weight: 600; color: #a5b4fc;"><?php echo htmlspecialchars($port ?: '--'); ?></td>
                                    <td>
                                        <?php if ($role === 'admin' && !empty($raw_pass)): ?>
                                            <div class="mask-pwd">
                                                <span id="pwd-field-<?php echo $inst_id; ?>" data-pwd="<?php echo htmlspecialchars($raw_pass); ?>">••••••••</span>
                                                <button class="btn-icon" onclick="togglePasswordDisplay('<?php echo $inst_id; ?>')">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                </button>
                                                <button class="btn-icon" onclick="copyPasswordDirect('<?php echo $inst_id; ?>')">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                                </button>
                                            </div>
                                        <?php elseif ($role === 'staff' && !empty($raw_pass)): ?>
                                            <span style="color: var(--text-secondary); font-style: italic; font-size: 11px;">Bị ẩn (Quyền Staff)</span>
                                        <?php else: ?>
                                            <span style="color: var(--text-secondary);">--</span>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <?php if ($status === 'success'): ?>
                                            <span class="badge badge-success">Thành công</span>
                                        <?php elseif ($status === 'installing'): ?>
                                            <span class="badge badge-installing">Đang cài...</span>
                                        <?php else: ?>
                                            <span class="badge badge-failed" title="<?php echo htmlspecialchars($inst['message'] ?? ''); ?>" style="cursor:help;">Thất bại</span>
                                        <?php endif; ?>
                                    </td>
                                    <td style="font-size: 12px; color: var(--text-secondary); font-family: monospace;"><?php echo htmlspecialchars($updated_at); ?></td>
                                    <td>
                                        <?php if (!empty($cpu_points)): ?>
                                            <!-- SVG Sparkline vẽ động trong PHP -->
                                            <svg class="sparkline" viewBox="0 0 100 30">
                                                <?php
                                                $max_val = 100;
                                                $points_str = '';
                                                $w_step = 100 / (count($cpu_points) - 1);
                                                foreach ($cpu_points as $i => $val) {
                                                    $x = $i * $w_step;
                                                    $y = 30 - ($val / $max_val) * 25; // 5px padding top
                                                    $points_str .= "$x,$y ";
                                                }
                                                ?>
                                                <polyline fill="none" stroke="var(--primary)" stroke-width="1.8" points="<?php echo trim($points_str); ?>" />
                                            </svg>
                                        <?php else: ?>
                                            <span style="font-size: 10px; color: var(--text-secondary); font-style: italic;">Chưa có stats</span>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <div class="action-cell">
                                            <?php if ($role === 'admin' && $status === 'success'): ?>
                                                <button class="btn btn-glass" style="padding: 4px 8px; font-size: 11px; display: inline-flex;" onclick="downloadCredentialsFile('<?php echo htmlspecialchars($ip); ?>', '<?php echo htmlspecialchars($port); ?>', '<?php echo htmlspecialchars($raw_pass); ?>')">
                                                    Tải file
                                                </button>
                                            <?php endif; ?>
                                            <?php if ($role === 'admin'): ?>
                                                <form method="POST" onsubmit="return confirm('Bạn có chắc muốn xóa lịch sử cài đặt của VPS: <?php echo htmlspecialchars($ip); ?> không?')" style="display:inline-block;">
                                                    <input type="hidden" name="vps_id" value="<?php echo htmlspecialchars($inst_id); ?>">
                                                    <button type="submit" name="action_delete" class="btn btn-glass text-red-400" style="padding: 4px 8px; font-size: 11px; background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.15)">
                                                        Xóa
                                                    </button>
                                                </form>
                                            <?php else: ?>
                                                <span style="color: var(--text-secondary); font-size: 11px;">--</span>
                                            <?php endif; ?>
                                        </div>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Audit log Section -->
        <div class="card-glass audit-logs-card">
            <h3 style="font-size: 15px; font-weight:600; display:flex; justify-content:space-between; align-items:center;">
                Nhật Ký Thao Tác Quản Trị Viên (Audit Logs)
                <button class="btn btn-glass" style="padding: 4px 10px; font-size:10px;" onclick="refreshAuditLogs()">Làm mới</button>
            </h3>
            <div class="audit-list" id="audit-logs-container">
                <div style="text-align: center; color: var(--text-secondary); font-size:12px; padding:20px;">Đang tải nhật ký...</div>
            </div>
        </div>
    </div>

    <!-- VPS DETAIL SYSTEM CHART DRAWER MODAL -->
    <div class="modal-overlay" id="vps-stats-modal">
        <div class="modal-card card-glass animate-fade-in">
            <div class="modal-header-flex">
                <div>
                    <h2 id="modal-vps-ip" style="font-size:18px; font-weight:700;">IP: 0.0.0.0</h2>
                    <p id="modal-vps-os" style="font-size:12px; color: var(--text-secondary); margin-top:2px;">Ubuntu OS</p>
                </div>
                <button class="modal-close" onclick="closeVPSStatsModal()">×</button>
            </div>
            
            <div class="vps-details-grid">
                <div class="vps-detail-item">
                    <span>CPU Hiện tại</span>
                    <strong id="detail-cpu">0.0 %</strong>
                </div>
                <div class="vps-detail-item">
                    <span>RAM Đang sử dụng</span>
                    <strong id="detail-ram">0.0 %</strong>
                </div>
                <div class="vps-detail-item">
                    <span>Dung lượng Disk</span>
                    <strong id="detail-disk">0.0 %</strong>
                </div>
            </div>

            <div class="chart-box">
                <h4 style="font-size:12px; font-weight:600; text-transform:uppercase; color: var(--text-secondary); margin-bottom:12px;">Lịch sử sử dụng tài nguyên (24 giờ gần nhất)</h4>
                <div class="chart-container">
                    <canvas id="resourceChart"></canvas>
                </div>
            </div>
            
            <div class="chart-box" style="margin-bottom:0;">
                <h4 style="font-size:12px; font-weight:600; text-transform:uppercase; color: var(--text-secondary); margin-bottom:12px;">Lịch sử lưu lượng băng thông (Network Traffic Bytes)</h4>
                <div class="chart-container">
                    <canvas id="networkChart"></canvas>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Copy text helper
        function copyText(elementId, toastMsg) {
            const el = document.getElementById(elementId);
            const text = el.innerText || el.textContent;
            navigator.clipboard.writeText(text).then(() => {
                alert(toastMsg);
            }).catch(err => {
                console.error('Không thể copy: ', err);
            });
        }

        // Hiện/Ẩn mật khẩu đăng nhập trực tiếp
        function togglePasswordDisplay(instId) {
            const field = document.getElementById('pwd-field-' + instId);
            const current = field.innerText;
            const plain = field.getAttribute('data-pwd');
            if (current === '••••••••') {
                field.innerText = plain;
            } else {
                field.innerText = '••••••••';
            }
        }

        // Copy mật khẩu nhanh
        function copyPasswordDirect(instId) {
            const field = document.getElementById('pwd-field-' + instId);
            const plain = field.getAttribute('data-pwd');
            navigator.clipboard.writeText(plain).then(() => {
                alert('Đã copy mật khẩu vào bộ nhớ tạm!');
            });
        }

        // Tải xuống file credentials đăng nhập về máy tính
        function downloadCredentialsFile(ip, port, password) {
            const loginLink = `http://${ip}:${port}/?password=${encodeURIComponent(password)}`;
            const content = `=======================================\nTHÔNG TIN ĐĂNG NHẬP PANEL VPS MANAGER\n=======================================\n\nĐịa chỉ IP VPS: ${ip}\nCổng Panel (Port): ${port}\nTài khoản (User): admin\nMật khẩu (Pass): ${password}\n\nLiên kết truy cập đăng nhập tự động:\n${loginLink}\n\n=======================================`;
            
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const element = document.createElement('a');
            element.href = URL.createObjectURL(blob);
            element.download = `vps_panel_credentials_${ip}.txt`;
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);

            // Báo cáo về audit log trung tâm
            fetch('stats.php?api=log_download&ip=' + encodeURIComponent(ip))
                .then(res => res.json())
                .then(() => refreshAuditLogs());
        }

        // Nạp và hiển thị Audit Logs
        function refreshAuditLogs() {
            const container = document.getElementById('audit-logs-container');
            fetch('stats.php?api=audit')
                .then(res => res.json())
                .then(data => {
                    if (data.length === 0) {
                        container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); font-size:12px; padding:20px;">Chưa có hoạt động quản trị nào.</div>';
                        return;
                    }
                    let html = '';
                    data.forEach(item => {
                        html += `
                            <div class="audit-item">
                                <div>
                                    <strong style="color: #6366f1;">${item.username}</strong> 
                                    <span style="color: #e2e8f0; margin: 0 4px;">(${item.action}):</span> 
                                    <span style="color: #cbd5e1;">${item.details}</span>
                                </div>
                                <div class="audit-time">${item.timestamp} <span style="color: #475569; font-size:10px;">[${item.ip}]</span></div>
                            </div>
                        `;
                    });
                    container.innerHTML = html;
                })
                .catch(err => {
                    container.innerHTML = '<div style="text-align: center; color: var(--danger); font-size:12px; padding:20px;">Lỗi tải lịch sử logs!</div>';
                });
        }

        // Global Charts variables để hủy trước khi vẽ lại
        let resourceChartInstance = null;
        let networkChartInstance = null;

        // Mở modal vẽ đồ thị lịch sử VPS
        function openVPSStats(ip, os) {
            document.getElementById('modal-vps-ip').innerText = "Máy chủ: " + ip;
            document.getElementById('modal-vps-os').innerText = os;
            
            const modal = document.getElementById('vps-stats-modal');
            modal.style.display = 'flex';

            // Reset values
            document.getElementById('detail-cpu').innerText = 'Đang tải...';
            document.getElementById('detail-ram').innerText = 'Đang tải...';
            document.getElementById('detail-disk').innerText = 'Đang tải...';

            fetch(`stats.php?api=stats&ip=${encodeURIComponent(ip)}`)
                .then(res => res.json())
                .then(history => {
                    if (history.length === 0) {
                        document.getElementById('detail-cpu').innerText = 'Chưa có dữ liệu';
                        document.getElementById('detail-ram').innerText = 'Chưa có dữ liệu';
                        document.getElementById('detail-disk').innerText = 'Chưa có dữ liệu';
                        if (resourceChartInstance) resourceChartInstance.destroy();
                        if (networkChartInstance) networkChartInstance.destroy();
                        return;
                    }

                    // Điền dữ liệu mới nhất
                    const latest = history[history.length - 1];
                    document.getElementById('detail-cpu').innerText = Number(latest.cpu).toFixed(1) + ' %';
                    document.getElementById('detail-ram').innerText = Number(latest.ram).toFixed(1) + ' %';
                    document.getElementById('detail-disk').innerText = Number(latest.disk).toFixed(1) + ' %';

                    // Parse arrays vẽ biểu đồ
                    const labels = history.map(h => h.timestamp.split(' ')[1].substring(0, 5)); // chỉ lấy Giờ:Phút
                    const cpuData = history.map(h => h.cpu);
                    const ramData = history.map(h => h.ram);
                    const diskData = history.map(h => h.disk);
                    const rxData = history.map(h => h.rx / (1024 * 1024)); // đổi ra MB
                    const txData = history.map(h => h.tx / (1024 * 1024)); // đổi ra MB

                    // Vẽ biểu đồ Tài nguyên
                    if (resourceChartInstance) resourceChartInstance.destroy();
                    const ctxRes = document.getElementById('resourceChart').getContext('2d');
                    resourceChartInstance = new Chart(ctxRes, {
                        type: 'line',
                        data: {
                            labels: labels,
                            datasets: [
                                { label: 'CPU (%)', data: cpuData, borderColor: '#a855f7', backgroundColor: 'rgba(168, 85, 247, 0.08)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 1 },
                                { label: 'RAM (%)', data: ramData, borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.08)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 1 },
                                { label: 'Disk (%)', data: diskData, borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.08)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 1 }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Outfit' } } } },
                            scales: {
                                y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
                                x: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: '#64748b', maxTicksLimit: 12 } }
                            }
                        }
                    });

                    // Vẽ biểu đồ Băng thông Mạng
                    if (networkChartInstance) networkChartInstance.destroy();
                    const ctxNet = document.getElementById('networkChart').getContext('2d');
                    networkChartInstance = new Chart(ctxNet, {
                        type: 'line',
                        data: {
                            labels: labels,
                            datasets: [
                                { label: 'Tải xuống (RX - MB)', data: rxData, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.05)', borderWidth: 1.5, fill: true, tension: 0.2, pointRadius: 0 },
                                { label: 'Tải lên (TX - MB)', data: txData, borderColor: '#ec4899', backgroundColor: 'rgba(236, 72, 153, 0.05)', borderWidth: 1.5, fill: true, tension: 0.2, pointRadius: 0 }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Outfit' } } } },
                            scales: {
                                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
                                x: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: '#64748b', maxTicksLimit: 12 } }
                            }
                        }
                    });
                });
        }

        function closeVPSStatsModal() {
            document.getElementById('vps-stats-modal').style.display = 'none';
        }

        // Tự động nạp logs ban đầu
        refreshAuditLogs();
    </script>
<?php endif; ?>

</body>
</html>
