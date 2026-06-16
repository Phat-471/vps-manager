<?php
/**
 * VPS Manager - Trình cấp mã cài đặt động
 * Khi chạy: curl -sSL https://hoangphat.site/cai | bash
 */
header('Content-Type: text/plain; charset=utf-8');

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

$script_path = __DIR__ . '/install.sh';

if (file_exists($script_path)) {
    $content = file_get_contents($script_path);
    // Thay thế placeholder bằng URL thật của hosting
    $content = str_replace('PANEL_URL_PLACEHOLDER', $panel_url, $content);
    // Thay thế token bảo mật
    $content = str_replace('SECURITY_TOKEN_PLACEHOLDER', $SECURITY_TOKEN, $content);
    echo $content;
} else {
    echo "# Lỗi: Không tìm thấy tệp install.sh mẫu trên máy chủ trung tâm.\n";
    echo "# Vui lòng đảm bảo tệp install.sh nằm cùng thư mục với index.php.\n";
}
