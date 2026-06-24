<?php
/**
 * BẢNG ĐIỀU KHIỂN THỐNG KÊ CÀI ĐẶT & GIÁM SÁT VPS TẬP TRUNG
 */

// Thiết lập cookie session bảo mật chống đánh cắp session ID
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_samesite', 'Strict');
if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
    ini_set('session.cookie_secure', 1);
}

session_start();
date_default_timezone_set('Asia/Ho_Chi_Minh');

require_once __DIR__ . '/config.php';

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

// Sinh CSRF Token chống giả mạo yêu cầu chéo trang
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// Cấu hình chống dò mật khẩu (Brute-force)
$lock_duration = 900; // Khóa 15 phút (900 giây)
$max_attempts = 5;
$login_error = '';

// Kiểm tra xem IP/Session này có đang bị khóa hay không
if (isset($_SESSION['lock_until']) && time() < $_SESSION['lock_until']) {
    $remaining_lock = $_SESSION['lock_until'] - time();
    $minutes = ceil($remaining_lock / 60);
    $login_error = "Đang tạm khóa. Vui lòng quay lại thử sau {$minutes} phút.";
}

// Xử lý Đăng nhập qua POST
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login_submit'])) {
    // 1. Xác thực CSRF Token
    if (empty($_POST['csrf_token']) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $_POST['csrf_token'])) {
        http_response_code(403);
        die('Lỗi bảo mật: CSRF Token không hợp lệ. Vui lòng tải lại trang.');
    }

    // 2. Kiểm tra trạng thái khóa brute-force
    if (isset($_SESSION['lock_until']) && time() < $_SESSION['lock_until']) {
        $remaining_lock = $_SESSION['lock_until'] - time();
        $minutes = ceil($remaining_lock / 60);
        $login_error = "Đang tạm khóa. Vui lòng quay lại thử sau {$minutes} phút.";
    } else {
        $username_input = trim($_POST['username'] ?? '');
        $password_input = $_POST['password'] ?? '';
        
        $authenticated_user = false;
        $role_assigned = '';
        $user_display_name = '';
        
        // Hàm phụ kiểm tra mật khẩu hỗ trợ cả mã hóa Bcrypt lẫn chuỗi văn bản trần
        function verify_user_password($input_pwd, $stored_pwd) {
            if (strpos($stored_pwd, '$2y$') === 0) {
                return password_verify($input_pwd, $stored_pwd);
            }
            return $input_pwd === $stored_pwd;
        }

        if ($username_input === $ADMIN_USER && verify_user_password($password_input, $ADMIN_PASSWORD)) {
            $authenticated_user = true;
            $role_assigned = 'admin';
            $user_display_name = 'Administrator';
        } elseif ($username_input === $STAFF_USER && verify_user_password($password_input, $STAFF_PASSWORD)) {
            $authenticated_user = true;
            $role_assigned = 'staff';
            $user_display_name = 'Staff Member';
        }

        if ($authenticated_user) {
            // Đăng nhập thành công: Reset bộ đếm số lần sai
            unset($_SESSION['login_attempts']);
            unset($_SESSION['lock_until']);
            
            $_SESSION['vps_authenticated'] = true;
            $_SESSION['vps_role'] = $role_assigned;
            $_SESSION['vps_user'] = $user_display_name;
            log_activity($user_display_name, 'Đăng nhập', 'Đăng nhập quyền ' . strtoupper($role_assigned) . ' thành công');
            header('Location: stats.php');
            exit;
        } else {
            // Đăng nhập thất bại: Tăng số lần thử sai
            if (!isset($_SESSION['login_attempts'])) {
                $_SESSION['login_attempts'] = 0;
            }
            $_SESSION['login_attempts']++;
            
            log_activity('Ẩn danh', 'Đăng nhập thất bại', "Thử tài khoản '{$username_input}' sai lần thứ {$_SESSION['login_attempts']} từ IP: " . $_SERVER['REMOTE_ADDR']);
            
            if ($_SESSION['login_attempts'] >= $max_attempts) {
                $_SESSION['lock_until'] = time() + $lock_duration;
                $login_error = "Nhập sai quá {$max_attempts} lần. Tài khoản đã bị tạm khóa trong 15 phút.";
            } else {
                $remaining = $max_attempts - $_SESSION['login_attempts'];
                $login_error = "Tài khoản hoặc mật khẩu không chính xác! Bạn còn {$remaining} lần thử.";
            }
        }
    }
}

// Kiểm tra trạng thái xác thực để render view phù hợp
$authenticated = $_SESSION['vps_authenticated'] ?? false;
$role = $_SESSION['vps_role'] ?? 'none';
$username = $_SESSION['vps_user'] ?? '';

// Hỗ trợ xác thực bằng Security Token qua Request Header hoặc URL Parameter đối với API
$received_token = '';
if (function_exists('getallheaders')) {
    $headers = getallheaders();
    foreach ($headers as $name => $value) {
        if (strcasecmp($name, 'X-Secure-Token') === 0) {
            $received_token = $value;
            break;
        }
    }
}
if (!$received_token && isset($_SERVER['HTTP_X_SECURE_TOKEN'])) {
    $received_token = $_SERVER['HTTP_X_SECURE_TOKEN'];
}
if (!$received_token && isset($_GET['token'])) {
    $received_token = $_GET['token'];
}

if (!empty($SECURITY_TOKEN) && $received_token === $SECURITY_TOKEN) {
    $authenticated = true;
    $role = 'admin'; // Cấp quyền admin khi truy cập qua API
    $username = 'API Token';
}

// Xử lý Yêu cầu AJAX (Nếu đã đăng nhập)
if ($authenticated) {
    // API nhận báo cáo lỗi gửi từ VPS
    if (isset($_GET['api']) && $_GET['api'] === 'report_bug' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        header('Content-Type: application/json');
        
        $input = file_get_contents('php://input');
        $payload = json_decode($input, true);
        
        if (!$payload || empty($payload['ip']) || empty($payload['logs'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Dữ liệu không hợp lệ']);
            exit;
        }
        
        $bug_file = $data_dir . '/bug_reports.json';
        $bug_reports = [];
        if (file_exists($bug_file)) {
            $bug_reports = json_decode(file_get_contents($bug_file), true) ?: [];
        }
        
        $new_bug = [
            'id' => 'bug_' . time() . '_' . rand(100, 999),
            'timestamp' => date('Y-m-d H:i:s'),
            'ip' => $payload['ip'],
            'task' => $payload['task'] ?? 'N/A',
            'details' => $payload['details'] ?? '',
            'logs' => $payload['logs']
        ];
        
        array_unshift($bug_reports, $new_bug);
        if (count($bug_reports) > 100) {
            $bug_reports = array_slice($bug_reports, 0, 100);
        }
        
        file_put_contents($bug_file, json_encode($bug_reports, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        
        echo json_encode(['success' => true]);
        exit;
    }

    // API lấy danh sách báo cáo lỗi
    if (isset($_GET['api']) && $_GET['api'] === 'get_bug_reports') {
        header('Content-Type: application/json');
        $bug_file = $data_dir . '/bug_reports.json';
        $bug_reports = [];
        if (file_exists($bug_file)) {
            $bug_reports = json_decode(file_get_contents($bug_file), true) ?: [];
        }
        echo json_encode($bug_reports);
        exit;
    }

    // API xóa báo cáo lỗi
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action_delete_bug']) && !empty($_POST['bug_id'])) {
        if ($role !== 'admin') {
            die('Không có quyền thực hiện.');
        }
        $bug_id = $_POST['bug_id'];
        $bug_file = $data_dir . '/bug_reports.json';
        if (file_exists($bug_file)) {
            $list = json_decode(file_get_contents($bug_file), true) ?: [];
            $new_list = [];
            foreach ($list as $item) {
                if ($item['id'] !== $bug_id) {
                    $new_list[] = $item;
                }
            }
            file_put_contents($bug_file, json_encode($new_list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            log_activity($username, 'Xóa Báo cáo lỗi', 'Xóa báo cáo lỗi ID: ' . $bug_id);
        }
        header('Location: stats.php');
        exit;
    }

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

    // 2.5. Lấy danh sách cài đặt VPS kèm theo thông tin Online/Offline (AJAX)
    if (isset($_GET['api']) && $_GET['api'] === 'list') {
        header('Content-Type: application/json');
        $installations = [];
        if (file_exists($db_file)) {
            $installations = json_decode(file_get_contents($db_file), true) ?: [];
        }
        
        $result = [];
        foreach ($installations as $inst) {
            $ip = $inst['ip'] ?? '';
            $status = $inst['status'] ?? 'unknown';
            $safe_ip = preg_replace('/[^a-zA-Z0-9_.-]/', '', $ip);
            $stats_file = $data_dir . '/stats/' . $safe_ip . '.json';
            
            // Xác định trạng thái Online/Offline dựa trên file tài nguyên gần nhất
            $online_status = 'offline';
            $cpu_points = [];
            
            if (file_exists($stats_file)) {
                $stats_data = json_decode(file_get_contents($stats_file), true) ?: [];
                if (!empty($stats_data)) {
                    $latest_stat = end($stats_data);
                    $last_time = strtotime($latest_stat['timestamp']);
                    $diff = time() - $last_time;
                    
                    // Nếu cập nhật trong vòng 10 phút (600 giây) thì coi như Online
                    if ($diff < 600) {
                        $online_status = 'online';
                    }
                    
                    // Lấy 10 điểm CPU gần nhất cho Sparkline
                    $recent_stats = array_slice($stats_data, -10);
                    foreach ($recent_stats as $st) {
                        $cpu_points[] = floatval($st['cpu'] ?? 0);
                    }
                }
            }
            
            // Xử lý che mật khẩu nếu quyền là staff
            $password_display = $inst['password'] ?? '';
            if ($role === 'staff' && !empty($password_display)) {
                $password_display = '••••••••';
            }
            
            $result[] = [
                'id' => $inst['id'] ?? '',
                'ip' => $ip,
                'port' => $inst['port'] ?? '',
                'password' => $password_display,
                'status' => $status,
                'message' => $inst['message'] ?? '',
                'os' => $inst['os'] ?? 'Linux OS',
                'createdAt' => $inst['createdAt'] ?? '',
                'updatedAt' => $inst['updatedAt'] ?? '',
                'duration' => $inst['duration'] ?? 0,
                'online' => $online_status,
                'cpuPoints' => $cpu_points
            ];
        }
        
        echo json_encode($result);
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

        /* Pagination Styles */
        .pagination-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-top: 1px solid var(--border-glass);
            background: rgba(255, 255, 255, 0.01);
            flex-wrap: wrap;
            gap: 16px;
        }

        .pagination-info {
            font-size: 13px;
            color: var(--text-secondary);
        }

        .pagination-info span {
            color: var(--text-primary);
            font-weight: 600;
        }

        .pagination-controls-wrapper {
            display: flex;
            align-items: center;
            gap: 20px;
            flex-wrap: wrap;
        }

        .items-per-page-container {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: var(--text-secondary);
        }

        .select-glass {
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border-glass);
            border-radius: 8px;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 13px;
            cursor: pointer;
            outline: none;
            transition: all 0.2s;
        }

        .select-glass:focus {
            border-color: var(--primary);
            box-shadow: 0 0 8px rgba(99, 102, 241, 0.2);
        }

        .select-glass option {
            background-color: var(--bg-dark);
            color: var(--text-primary);
        }

        .pagination-buttons {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .page-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 32px;
            height: 32px;
            padding: 0 8px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            color: var(--text-secondary);
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border-glass);
            cursor: pointer;
            transition: all 0.2s ease;
            user-select: none;
        }

        .page-btn:hover:not(:disabled) {
            color: var(--text-primary);
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.15);
            transform: translateY(-1px);
        }

        .page-btn.active {
            color: #fff;
            background: var(--primary);
            border-color: var(--primary);
            box-shadow: 0 0 12px var(--primary-glow);
            font-weight: 600;
        }

        .page-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }

        .page-btn-dots {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 32px;
            height: 32px;
            color: var(--text-secondary);
            font-size: 13px;
            user-select: none;
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
                <!-- Token bảo mật chống CSRF -->
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token'] ?? ''); ?>">
                
                <div class="form-group">
                    <label for="username">Tên đăng nhập</label>
                    <input type="text" name="username" id="username" required class="input-glass" placeholder="Nhập tên đăng nhập..." autofocus autocomplete="username">
                </div>
                
                <div class="form-group">
                    <label for="password">Mật khẩu</label>
                    <input type="password" name="password" id="password" required class="input-glass" placeholder="Nhập mật khẩu..." autocomplete="current-password">
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
                    <h4 id="kpi-total" class="kpi-val-animate"><?php echo $kpi['total']; ?></h4>
                    <p>Tổng số VPS cài đặt</p>
                </div>
            </div>
            <div class="stat-card card-glass">
                <div class="stat-icon" style="background: var(--success-glow); color: var(--success);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div class="stat-details">
                    <h4 id="kpi-success" class="kpi-val-animate"><?php echo $kpi['success']; ?></h4>
                    <p>Cài đặt thành công</p>
                </div>
            </div>
            <div class="stat-card card-glass">
                <div class="stat-icon" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
                </div>
                <div class="stat-details">
                    <h4 id="kpi-installing" class="kpi-val-animate"><?php echo $kpi['installing']; ?></h4>
                    <p>Đang tiến hành cài</p>
                </div>
            </div>
            <div class="stat-card card-glass">
                <div class="stat-icon" style="background: var(--danger-glow); color: var(--danger);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                </div>
                <div class="stat-details">
                    <h4 id="kpi-failed" class="kpi-val-animate"><?php echo $kpi['failed']; ?></h4>
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

        <!-- Search and Filter Controls -->
        <style>
            .controls-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 16px;
                margin-bottom: 20px;
                flex-wrap: wrap;
            }
            .search-box-container {
                position: relative;
                flex: 1;
                min-width: 280px;
            }
            .search-box-container svg {
                position: absolute;
                left: 14px;
                top: 50%;
                transform: translateY(-50%);
                color: var(--text-secondary);
                pointer-events: none;
            }
            .search-input {
                padding-left: 42px !important;
            }
            .filter-tabs {
                display: flex;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid var(--border-glass);
                padding: 4px;
                border-radius: 10px;
                gap: 4px;
            }
            .filter-tab {
                padding: 6px 14px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 500;
                color: var(--text-secondary);
                cursor: pointer;
                transition: all 0.2s;
                border: none;
                background: none;
            }
            .filter-tab:hover {
                color: var(--text-primary);
                background: rgba(255, 255, 255, 0.02);
            }
            .filter-tab.active {
                color: var(--text-primary);
                background: rgba(99, 102, 241, 0.2);
                border: 1px solid rgba(99, 102, 241, 0.3);
            }
            .online-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                display: inline-block;
                margin-right: 6px;
                vertical-align: middle;
            }
            .dot-online {
                background-color: var(--success);
                box-shadow: 0 0 8px var(--success);
            }
            .dot-offline {
                background-color: #64748b;
            }
            .dot-installing {
                background-color: #3b82f6;
                animation: pulse-dot 1.2s infinite;
            }
            @keyframes pulse-dot {
                0% { opacity: 0.5; transform: scale(0.9); }
                50% { opacity: 1; transform: scale(1.1); }
                100% { opacity: 0.5; transform: scale(0.9); }
            }
            .auto-refresh-container {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 13px;
                color: var(--text-secondary);
            }
            /* Switch styles */
            .switch {
                position: relative;
                display: inline-block;
                width: 38px;
                height: 20px;
            }
            .switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(255, 255, 255, 0.08);
                transition: .3s;
                border-radius: 20px;
                border: 1px solid var(--border-glass);
            }
            .slider:before {
                position: absolute;
                content: "";
                height: 12px;
                width: 12px;
                left: 3px;
                bottom: 3px;
                background-color: var(--text-secondary);
                transition: .3s;
                border-radius: 50%;
            }
            input:checked + .slider {
                background-color: var(--primary);
                border-color: rgba(99, 102, 241, 0.4);
            }
            input:checked + .slider:before {
                transform: translateX(18px);
                background-color: white;
            }
            .kpi-val-animate {
                transition: all 0.3s ease;
            }
        </style>

        <div class="controls-row">
            <div class="search-box-container">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" id="vps-search" class="input-glass search-input" placeholder="Tìm kiếm IP, Hệ điều hành, trạng thái...">
            </div>
            
            <div class="filter-tabs">
                <button class="filter-tab active" data-filter="all">Tất cả</button>
                <button class="filter-tab" data-filter="online">Online</button>
                <button class="filter-tab" data-filter="installing">Đang cài</button>
                <button class="filter-tab" data-filter="failed">Lỗi cài đặt</button>
            </div>

            <div class="auto-refresh-container">
                <label class="switch">
                    <input type="checkbox" id="auto-refresh-toggle" checked>
                    <span class="slider"></span>
                </label>
                <span>Tự động làm mới (10s)</span>
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
                    <tbody id="vps-table-body">
                        <tr>
                            <td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 32px;">Đang tải danh sách VPS...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <!-- Pagination Controls -->
            <div class="pagination-container">
                <div class="pagination-info">
                    Hiển thị <span id="paginated-start">0</span> - <span id="paginated-end">0</span> trong tổng số <span id="paginated-total">0</span> máy chủ
                </div>
                <div class="pagination-controls-wrapper">
                    <div class="items-per-page-container">
                        <span>Số dòng hiển thị:</span>
                        <select id="items-per-page-select" class="select-glass">
                            <option value="5">5</option>
                            <option value="10" selected>10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </div>
                    <div class="pagination-buttons" id="pagination-buttons-container">
                        <!-- Sẽ được tạo động bằng JavaScript -->
                    </div>
                </div>
            </div>
        </div>

        <!-- Bug Reports Section -->
        <div class="table-card card-glass" style="margin-top: 28px;">
            <div class="table-header">
                <h3>Báo Cáo Lỗi Cài Đặt VPS (Bug Reports)</h3>
                <span style="font-size: 11px; color: var(--text-secondary);">Danh sách nhật ký lỗi cài đặt được gửi về tự động từ các VPS</span>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Thời gian</th>
                            <th>IP VPS</th>
                            <th>Tác vụ</th>
                            <th>Mô tả sự cố</th>
                            <th>Hành động</th>
                        </tr>
                    </thead>
                    <tbody id="bug-table-body">
                        <tr>
                            <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 32px;">Đang tải danh sách báo cáo lỗi...</td>
                        </tr>
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

    <!-- BUG DETAIL MODAL -->
    <div class="modal-overlay" id="bug-detail-modal">
        <div class="modal-card card-glass animate-fade-in" style="max-width: 800px; max-height: 80vh; display: flex; flex-direction: column; padding: 24px;">
            <div class="modal-header-flex" style="border-bottom: 1px solid var(--border-glass); padding-bottom: 12px; margin-bottom: 16px;">
                <div>
                    <h2 id="modal-bug-title" style="font-size:18px; font-weight:700; color: var(--danger);">Chi tiết báo cáo lỗi</h2>
                    <p id="modal-bug-subtitle" style="font-size:12px; color: var(--text-secondary); margin-top:2px;">Thời gian | IP: 0.0.0.0</p>
                </div>
                <button class="modal-close" onclick="closeBugDetailModal()">×</button>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; gap: 12px;">
                <div id="modal-bug-details" style="font-size: 13px; color: var(--text-primary); padding: 10px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid var(--border-glass);">
                    Chi tiết lỗi...
                </div>
                <pre id="modal-bug-logs" style="flex: 1; background: rgba(0,0,0,0.5); color: #f87171; padding: 14px; font-family: monospace; font-size: 12px; overflow-y: auto; white-space: pre-wrap; padding: 12px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2);"></pre>
            </div>
            <div style="display: flex; gap: 12px; margin-top: 16px; border-top: 1px solid var(--border-glass); padding-top: 12px; justify-content: flex-end;">
                <button class="btn btn-primary" onclick="copyBugLogsDirect()">Sao chép log</button>
                <button class="btn btn-glass" onclick="closeBugDetailModal()">Đóng</button>
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

        let currentVPSData = [];
        let currentBugData = [];
        let currentFilter = 'all';
        let searchQuery = '';
        let refreshIntervalId = null;
        let currentPage = 1;
        let itemsPerPage = 10;

        // Tải danh sách báo cáo lỗi từ máy chủ trung tâm
        function loadBugReports() {
            fetch('stats.php?api=get_bug_reports')
                .then(res => res.json())
                .then(data => {
                    currentBugData = data;
                    renderBugTable();
                })
                .catch(err => {
                    console.error('Lỗi tải danh sách bug report: ', err);
                    document.getElementById('bug-table-body').innerHTML = `
                        <tr>
                            <td colspan="5" style="text-align: center; color: var(--danger); padding: 32px;">Lỗi tải dữ liệu báo cáo lỗi!</td>
                        </tr>
                    `;
                });
        }

        // Render bảng dữ liệu báo cáo lỗi
        function renderBugTable() {
            const tbody = document.getElementById('bug-table-body');
            if (currentBugData.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 32px;">Chưa nhận được báo cáo lỗi nào từ VPS khách hàng.</td>
                    </tr>
                `;
                return;
            }
            
            let html = '';
            currentBugData.forEach(item => {
                const userRole = '<?php echo $role; ?>';
                let actionHtml = `
                    <button class="btn btn-glass" style="padding: 4px 8px; font-size: 11px; display: inline-flex;" onclick="openBugDetailModal('${item.id}')">
                        Xem chi tiết
                    </button>
                `;
                if (userRole === 'admin') {
                    actionHtml += `
                        <form method="POST" onsubmit="return confirm('Bạn có chắc muốn xóa báo cáo lỗi này không?')" style="display:inline-block;">
                            <input type="hidden" name="bug_id" value="${escapeHtml(item.id)}">
                            <button type="submit" name="action_delete_bug" class="btn btn-glass" style="padding: 4px 8px; font-size: 11px; background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.15); color: #f87171;">
                                Xóa
                            </button>
                        </form>
                    `;
                }
                
                html += `
                    <tr>
                        <td style="color: var(--text-secondary); font-size: 12px;">${escapeHtml(item.timestamp)}</td>
                        <td style="color: #60a5fa; font-weight: 600;">${escapeHtml(item.ip)}</td>
                        <td><span class="badge badge-failed">${escapeHtml(item.task)}</span></td>
                        <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--text-secondary);">${escapeHtml(item.details)}</td>
                        <td><div class="action-cell">${actionHtml}</div></td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }

        let activeBugLogs = '';
        function openBugDetailModal(id) {
            const bug = currentBugData.find(b => b.id === id);
            if (!bug) return;
            
            activeBugLogs = bug.logs;
            document.getElementById('modal-bug-subtitle').innerText = `${bug.timestamp} | IP: ${bug.ip}`;
            document.getElementById('modal-bug-details').innerText = bug.details || 'Không có mô tả chi tiết';
            document.getElementById('modal-bug-logs').textContent = bug.logs || 'Không có dữ liệu logs';
            document.getElementById('bug-detail-modal').style.display = 'flex';
        }

        function closeBugDetailModal() {
            document.getElementById('bug-detail-modal').style.display = 'none';
        }

        function copyBugLogsDirect() {
            navigator.clipboard.writeText(activeBugLogs).then(() => {
                alert('Đã copy logs lỗi vào Clipboard!');
            }).catch(err => {
                console.error('Không thể copy: ', err);
            });
        }

        // Tải danh sách VPS và hiển thị
        function loadVPSList() {
            fetch('stats.php?api=list')
                .then(res => res.json())
                .then(data => {
                    currentVPSData = data;
                    renderVPSTable();
                    updateKPICards(data);
                })
                .catch(err => {
                    console.error('Lỗi tải danh sách VPS: ', err);
                    document.getElementById('vps-table-body').innerHTML = `
                        <tr>
                            <td colspan="8" style="text-align: center; color: var(--danger); padding: 32px;">Lỗi tải dữ liệu từ máy chủ trung tâm!</td>
                        </tr>
                    `;
                });
        }

        // Cập nhật các thẻ KPI
        function updateKPICards(data) {
            let total = data.length;
            let success = 0;
            let installing = 0;
            let failed = 0;

            data.forEach(item => {
                if (item.status === 'success') success++;
                else if (item.status === 'installing') installing++;
                else if (item.status === 'failed') failed++;
            });

            document.getElementById('kpi-total').innerText = total;
            document.getElementById('kpi-success').innerText = success;
            document.getElementById('kpi-installing').innerText = installing;
            document.getElementById('kpi-failed').innerText = failed;
        }

        // Render bảng dữ liệu VPS
        function renderVPSTable() {
            const tbody = document.getElementById('vps-table-body');
            
            // Lọc dữ liệu
            let filtered = currentVPSData;
            
            // Lọc theo search box
            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                filtered = filtered.filter(item => 
                    item.ip.toLowerCase().includes(query) || 
                    item.os.toLowerCase().includes(query) || 
                    item.status.toLowerCase().includes(query)
                );
            }
            
            // Lọc theo Tabs
            if (currentFilter === 'online') {
                filtered = filtered.filter(item => item.online === 'online');
            } else if (currentFilter === 'installing') {
                filtered = filtered.filter(item => item.status === 'installing');
            } else if (currentFilter === 'failed') {
                filtered = filtered.filter(item => item.status === 'failed');
            }
            
            const totalItems = filtered.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            
            // Đảm bảo currentPage hợp lệ
            if (currentPage < 1) {
                currentPage = 1;
            }
            if (totalPages > 0 && currentPage > totalPages) {
                currentPage = totalPages;
            }
            
            if (totalItems === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 32px;">Không tìm thấy máy chủ VPS nào phù hợp.</td>
                    </tr>
                `;
                // Cập nhật giao diện phân trang khi trống
                document.getElementById('paginated-start').innerText = 0;
                document.getElementById('paginated-end').innerText = 0;
                document.getElementById('paginated-total').innerText = 0;
                renderPaginationControls(0);
                return;
            }
            
            // Tính toán chỉ số bắt đầu và kết thúc của trang hiện tại
            const reversedFiltered = [...filtered].reverse();
            const startIdx = (currentPage - 1) * itemsPerPage;
            const endIdx = Math.min(startIdx + itemsPerPage, totalItems);
            const paginatedItems = reversedFiltered.slice(startIdx, endIdx);
            
            // Cập nhật thông số hiển thị
            document.getElementById('paginated-start').innerText = startIdx + 1;
            document.getElementById('paginated-end').innerText = endIdx;
            document.getElementById('paginated-total').innerText = totalItems;
            
            // Render các hàng của trang hiện tại
            let html = '';
            paginatedItems.forEach(item => {
                const isInstalling = item.status === 'installing';
                
                // Chỉ báo Online/Offline
                let statusDot = '';
                if (isInstalling) {
                    statusDot = `<span class="online-dot dot-installing" title="Đang tiến hành cài đặt"></span>`;
                } else if (item.online === 'online') {
                    statusDot = `<span class="online-dot dot-online" title="Online (Hoạt động)"></span>`;
                } else {
                    statusDot = `<span class="online-dot dot-offline" title="Offline (Mất kết nối / Không có monitor)"></span>`;
                }
                
                // Badge trạng thái cài đặt
                let badgeClass = 'badge-failed';
                let statusText = 'Thất bại';
                if (item.status === 'success') {
                    badgeClass = 'badge-success';
                    statusText = 'Thành công';
                } else if (item.status === 'installing') {
                    badgeClass = 'badge-installing';
                    statusText = 'Đang cài...';
                }
                
                // Sparkline SVG vẽ động qua JS
                let sparklineHtml = '<span style="font-size: 10px; color: var(--text-secondary); font-style: italic;">Chưa có stats</span>';
                if (item.cpuPoints && item.cpuPoints.length > 0) {
                    const points = item.cpuPoints;
                    const maxVal = 100;
                    const wStep = 100 / (points.length - 1 || 1);
                    let pointsStr = '';
                    points.forEach((val, i) => {
                        const x = i * wStep;
                        const y = 30 - (val / maxVal) * 25; // 5px padding top
                        pointsStr += `${x},${y} `;
                    });
                    sparklineHtml = `
                        <svg class="sparkline" viewBox="0 0 100 30">
                            <polyline fill="none" stroke="var(--primary)" stroke-width="1.8" points="${pointsStr.trim()}" />
                        </svg>
                    `;
                }
                
                // Mật khẩu che/hiện
                const userRole = '<?php echo $role; ?>';
                let passwordHtml = '<span style="color: var(--text-secondary);">--</span>';
                if (userRole === 'admin' && item.password) {
                    passwordHtml = `
                        <div class="mask-pwd">
                            <span id="pwd-field-${item.id}" data-pwd="${escapeHtml(item.password)}">••••••••</span>
                            <button class="btn-icon" onclick="togglePasswordDisplay('${item.id}')">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                            <button class="btn-icon" onclick="copyPasswordDirect('${item.id}')">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                        </div>
                    `;
                } else if (userRole === 'staff' && item.password) {
                    passwordHtml = `<span style="color: var(--text-secondary); font-style: italic; font-size: 11px;">Bị ẩn (Quyền Staff)</span>`;
                }
                
                // Nút hành động
                let actionHtml = '';
                if (userRole === 'admin' && item.status === 'success') {
                    actionHtml += `
                        <button class="btn btn-glass" style="padding: 4px 8px; font-size: 11px; display: inline-flex;" onclick="downloadCredentialsFile('${escapeHtml(item.ip)}', '${escapeHtml(item.port)}', '${escapeHtml(item.password)}')">
                            Tải file
                        </button>
                    `;
                }
                if (userRole === 'admin') {
                    actionHtml += `
                        <form method="POST" onsubmit="return confirm('Bạn có chắc muốn xóa lịch sử cài đặt của VPS: ${escapeHtml(item.ip)} không?')" style="display:inline-block;">
                            <input type="hidden" name="vps_id" value="${escapeHtml(item.id)}">
                            <button type="submit" name="action_delete" class="btn btn-glass" style="padding: 4px 8px; font-size: 11px; background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.15); color: #f87171;">
                                Xóa
                            </button>
                        </form>
                    `;
                } else {
                    actionHtml = `<span style="color: var(--text-secondary); font-size: 11px;">--</span>`;
                }
                
                html += `
                    <tr>
                        <td>
                            ${statusDot}
                            <a href="#" onclick="openVPSStats('${escapeHtml(item.ip)}', '${escapeHtml(item.os)}')" style="color: #60a5fa; font-weight: 600; text-decoration: none; border-bottom: 1px dashed rgba(96,165,250,0.4);">
                                ${escapeHtml(item.ip)}
                            </a>
                        </td>
                        <td style="color: var(--text-secondary); font-size: 12px;">${escapeHtml(item.os)}</td>
                        <td style="font-family: monospace; font-weight: 600; color: #a5b4fc;">${escapeHtml(item.port || '--')}</td>
                        <td>${passwordHtml}</td>
                        <td>
                            <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
                                <span class="badge ${badgeClass}" ${item.status === 'failed' ? `title="${escapeHtml(item.message)}"` : ''} style="${item.status === 'failed' ? 'cursor:help;' : ''}">
                                    ${statusText}
                                </span>
                                ${item.message ? `<span class="failed-msg" style="font-size: 10px; color: ${item.status === 'failed' ? '#f87171' : 'var(--text-secondary)'}; max-width: 180px; white-space: normal; line-height: 1.3; font-weight: 500; word-break: break-word;">${escapeHtml(item.message)}</span>` : ''}
                            </div>
                        </td>
                        <td style="font-size: 12px; color: var(--text-secondary); font-family: monospace;">${escapeHtml(item.updatedAt)}</td>
                        <td>${sparklineHtml}</td>
                        <td>
                            <div class="action-cell">
                                ${actionHtml}
                            </div>
                        </td>
                    </tr>
                `;
            });
            
            tbody.innerHTML = html;
            
            // Vẽ các điều khiển phân trang
            renderPaginationControls(totalPages);
        }

        // Vẽ điều khiển phân trang
        function renderPaginationControls(totalPages) {
            const container = document.getElementById('pagination-buttons-container');
            if (!container) return;
            
            if (totalPages <= 1) {
                container.innerHTML = '';
                return;
            }
            
            let buttonsHtml = '';
            
            // Nút Trước (Prev)
            buttonsHtml += `
                <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})" title="Trang trước">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
            `;
            
            // Tính toán danh sách trang cần hiển thị
            const pages = [];
            if (totalPages <= 5) {
                for (let i = 1; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                if (currentPage <= 3) {
                    pages.push(1, 2, 3, 4, '...', totalPages);
                } else if (currentPage >= totalPages - 2) {
                    pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                } else {
                    pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
                }
            }
            
            // Render từng nút trang
            pages.forEach(p => {
                if (p === '...') {
                    buttonsHtml += `<span class="page-btn-dots">...</span>`;
                } else {
                    buttonsHtml += `
                        <button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="changePage(${p})">
                            ${p}
                        </button>
                    `;
                }
            });
            
            // Nút Sau (Next)
            buttonsHtml += `
                <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})" title="Trang sau">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
            `;
            
            container.innerHTML = buttonsHtml;
        }

        // Thay đổi trang và render lại bảng
        function changePage(page) {
            currentPage = page;
            renderVPSTable();
        }

        // Hỗ trợ escape HTML chống XSS
        function escapeHtml(text) {
            if (!text) return '';
            return text.toString()
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
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

        // Thiết lập các sự kiện
        document.addEventListener('DOMContentLoaded', () => {
            // Tải dữ liệu ban đầu
            loadVPSList();
            loadBugReports();
            refreshAuditLogs();

            // Xử lý Tìm kiếm
            const searchInput = document.getElementById('vps-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    searchQuery = e.target.value;
                    currentPage = 1; // Reset về trang đầu khi tìm kiếm
                    renderVPSTable();
                });
            }

            // Xử lý Tabs lọc
            const filterTabs = document.querySelectorAll('.filter-tab');
            filterTabs.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    filterTabs.forEach(t => t.classList.remove('active'));
                    e.target.classList.add('active');
                    currentFilter = e.target.getAttribute('data-filter');
                    currentPage = 1; // Reset về trang đầu khi đổi bộ lọc
                    renderVPSTable();
                });
            });

            // Xử lý thay đổi số dòng hiển thị trên mỗi trang
            const itemsPerPageSelect = document.getElementById('items-per-page-select');
            if (itemsPerPageSelect) {
                itemsPerPageSelect.addEventListener('change', (e) => {
                    itemsPerPage = parseInt(e.target.value, 10);
                    currentPage = 1; // Reset về trang đầu khi đổi cỡ trang
                    renderVPSTable();
                });
            }

            // Xử lý Tự động làm mới
            const refreshToggle = document.getElementById('auto-refresh-toggle');
            
            function startAutoRefresh() {
                if (refreshIntervalId) clearInterval(refreshIntervalId);
                refreshIntervalId = setInterval(() => {
                    loadVPSList();
                    loadBugReports();
                }, 10000); // 10 giây
            }

            if (refreshToggle) {
                if (refreshToggle.checked) {
                    startAutoRefresh();
                }
                refreshToggle.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        startAutoRefresh();
                    } else {
                        if (refreshIntervalId) {
                            clearInterval(refreshIntervalId);
                            refreshIntervalId = null;
                        }
                    }
                });
            }
        });
    </script>
<?php endif; ?>

</body>
</html>
