<?php
/**
 * VPS Manager - Trình cấp mã cài đặt động & Trang chủ giới thiệu
 */

// Tự động phát hiện giao thức (HTTP hoặc HTTPS)
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https" : "http";
$host = $_SERVER['HTTP_HOST'];

// Đường dẫn URL đến thư mục chứa tệp tin này
$request_uri = $_SERVER['REQUEST_URI'];
if (($pos = strpos($request_uri, '?')) !== false) {
    $request_uri = substr($request_uri, 0, $pos);
}
if (preg_match('/index\.php$/i', $request_uri)) {
    $request_uri = preg_replace('/index\.php$/i', '', $request_uri);
}
$request_uri = rtrim($request_uri, '/') . '/';

$panel_url = $protocol . "://" . $host . $request_uri;
$panel_url = rtrim($panel_url, '/');

require_once __DIR__ . '/config.php';

// Kiểm tra User Agent để phát hiện xem là gọi từ dòng lệnh (curl/wget) hay trình duyệt
$user_agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$is_cli = preg_match('/(curl|wget|fetch|libcurl)/i', $user_agent);

if ($is_cli) {
    // 1. CHẾ ĐỘ DÒNG LỆNH (CLI): Trả về mã Bash Script thô để cài đặt trực tiếp
    header('Content-Type: text/plain; charset=utf-8');
    $script_path = __DIR__ . '/install.sh';
    
    if (file_exists($script_path)) {
        $content = file_get_contents($script_path);
        // Thay thế placeholder bằng URL thật của hosting
        $content = str_replace('PANEL_URL_PLACEHOLDER', $panel_url, $content);
        // Thay thế token bảo mật
        $content = str_replace('SECURITY_TOKEN_PLACEHOLDER', $SECURITY_TOKEN, $content);
        // Chuyển đổi định dạng dòng từ Windows (CRLF) sang Linux (LF)
        $content = str_replace(["\r\n", "\r"], "\n", $content);
        echo $content;
    } else {
        echo "# Lỗi: Không tìm thấy tệp install.sh mẫu trên máy chủ trung tâm.\n";
        echo "# Vui lòng đảm bảo tệp install.sh nằm cùng thư mục với index.php.\n";
    }
    exit;
}

// 2. CHẾ ĐỘ TRÌNH DUYỆT (BROWSER): Hiển thị trang hướng dẫn cài đặt trực quan & đẹp mắt
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VPS Manager - Trình Quản Lý & Cài Đặt VPS Tự Động</title>
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-dark: #070913;
            --bg-card: rgba(16, 20, 38, 0.4);
            --border-glass: rgba(255, 255, 255, 0.08);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --primary: #6366f1;
            --primary-glow: rgba(99, 102, 241, 0.2);
            --success: #10b981;
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
            line-height: 1.6;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow-x: hidden;
            position: relative;
        }

        /* Ambient background glows */
        body::before {
            content: '';
            position: absolute;
            top: -200px;
            left: -100px;
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
            z-index: -1;
            pointer-events: none;
        }

        body::after {
            content: '';
            position: absolute;
            bottom: -100px;
            right: -100px;
            width: 700px;
            height: 700px;
            background: radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, transparent 70%);
            z-index: -1;
            pointer-events: none;
        }

        .container {
            width: 100%;
            max-width: 960px;
            margin: 0 auto;
            padding: 40px 24px;
            flex: 1;
        }

        /* Card Glassmorphism */
        .card-glass {
            background: var(--bg-card);
            border: 1px solid var(--border-glass);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-radius: 24px;
            box-shadow: 0 16px 40px 0 rgba(0, 0, 0, 0.4);
            padding: 40px;
            margin-top: 30px;
        }

        /* Hero Section */
        .hero {
            text-align: center;
            margin-bottom: 20px;
        }

        .logo-container {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 72px;
            height: 72px;
            border-radius: 20px;
            background: rgba(99, 102, 241, 0.1);
            border: 1px solid rgba(99, 102, 241, 0.2);
            color: var(--primary);
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 24px;
            box-shadow: 0 0 30px rgba(99, 102, 241, 0.2);
        }

        .hero h1 {
            font-size: 38px;
            font-weight: 800;
            letter-spacing: -1px;
            background: linear-gradient(135deg, #fff 40%, var(--primary) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 12px;
        }

        .hero p {
            font-size: 16px;
            color: var(--text-secondary);
            max-width: 600px;
            margin: 0 auto;
            font-weight: 400;
        }

        /* Code Block */
        .code-container {
            margin: 32px 0;
            position: relative;
        }

        .code-label {
            font-size: 11px;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
            display: block;
        }

        .code-box {
            background: rgba(0, 0, 0, 0.45);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 14px;
            padding: 18px 24px;
            font-family: monospace;
            font-size: 14px;
            color: #38bdf8;
            overflow-x: auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            box-shadow: inset 0 2px 8px rgba(0,0,0,0.8);
        }

        .code-line {
            white-space: nowrap;
            user-select: all;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
            font-family: inherit;
            gap: 8px;
            text-decoration: none;
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
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border-glass);
            color: var(--text-primary);
        }

        .btn-glass:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.15);
        }

        /* Instruction Steps */
        .steps {
            margin-top: 36px;
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            padding-top: 36px;
        }

        .steps h3 {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 24px;
        }

        .step-item {
            display: flex;
            gap: 20px;
            margin-bottom: 24px;
            align-items: flex-start;
        }

        .step-number {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(99, 102, 241, 0.1);
            border: 1px solid rgba(99, 102, 241, 0.2);
            color: var(--primary);
            font-weight: 700;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 0 10px rgba(99, 102, 241, 0.05);
        }

        .step-content h4 {
            font-size: 15px;
            font-weight: 600;
            margin-bottom: 6px;
        }

        .step-content p {
            font-size: 13.5px;
            color: var(--text-secondary);
        }

        .buttons-row {
            display: flex;
            justify-content: center;
            gap: 16px;
            margin-top: 24px;
        }

        footer {
            text-align: center;
            padding: 30px 24px;
            font-size: 12px;
            color: var(--text-secondary);
            border-top: 1px solid rgba(255, 255, 255, 0.04);
        }

        footer a {
            color: var(--primary);
            text-decoration: none;
        }

        footer a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>

    <div class="container">
        <!-- Hero Title -->
        <div class="hero">
            <div class="logo-container">⚡</div>
            <h1>VPS Manager Panel</h1>
            <p>Giải pháp tối ưu để tự động hóa quy trình thiết lập, quản lý, cài đặt mã nguồn 1-click và giám sát hiệu năng VPS của bạn.</p>
        </div>

        <!-- Main Installer Guide Card -->
        <div class="card-glass">
            <!-- Command line box -->
            <div class="code-container">
                <span class="code-label">Lệnh Cài Đặt Nhanh (Dành cho Root VPS):</span>
                <div class="code-box">
                    <?php
                    $cmd_line = "curl -sSL " . $panel_url . " | bash";
                    ?>
                    <div class="code-line" id="cmd-install"><?php echo htmlspecialchars($cmd_line); ?></div>
                    <button class="btn btn-glass" style="padding: 8px 16px; font-size: 12px;" onclick="copyCommand()">Sao chép</button>
                </div>
            </div>

            <!-- Steps -->
            <div class="steps">
                <h3>Hướng Dẫn Thiết Lập Từng Bước:</h3>
                
                <div class="step-item">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <h4>Kết nối SSH vào máy chủ VPS</h4>
                        <p>Sử dụng các phần mềm Terminal (như PuTTY, MobaXterm, hoặc Terminal trên MacOS/Linux) và đăng nhập với tư cách tài khoản <strong>root</strong>.</p>
                    </div>
                </div>

                <div class="step-item">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <h4>Sao chép và chạy Lệnh cài đặt</h4>
                        <p>Sao chép dòng lệnh màu xanh phía trên, dán vào cửa sổ SSH của VPS và nhấn <strong>Enter</strong>. Quá trình cài đặt môi trường và cấu hình tự động sẽ diễn ra trong 1-2 phút.</p>
                    </div>
                </div>

                <div class="step-item">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <h4>Đăng nhập và bắt đầu Quản lý</h4>
                        <p>Sau khi tiến trình cài đặt hoàn thành, hệ thống sẽ in ra địa chỉ truy cập kèm mật khẩu (ví dụ: <code>http://IP_VPS:35622/?password=...</code>). Nhấp vào liên kết để truy cập Bảng quản trị.</p>
                    </div>
                </div>
            </div>

            <!-- Navigation Buttons -->
            <div class="buttons-row">
                <a href="stats.php" class="btn btn-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px;"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
                    Bảng điều khiển trung tâm (Stats Dashboard)
                </a>
            </div>
        </div>
    </div>

    <!-- Footer -->
    <footer>
        <p>&copy; <?php echo date('Y'); ?> VPS Manager. Tất cả quyền được bảo lưu.</p>
        <p style="margin-top:4px;">Thiết kế bảo mật & tối giản bởi <a href="https://github.com/Phat-471" target="_blank">Phat-471</a>.</p>
    </footer>

    <script>
        function copyCommand() {
            const el = document.getElementById('cmd-install');
            const text = el.innerText || el.textContent;
            navigator.clipboard.writeText(text).then(() => {
                alert('Đã copy lệnh cài đặt vào bộ nhớ tạm!');
            }).catch(err => {
                console.error('Không thể copy: ', err);
            });
        }
    </script>

</body>
</html>
