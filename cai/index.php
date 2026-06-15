<?php
/**
 * VPS Manager - Trình cấp mã cài đặt động
 * Khi chạy: curl -sSL https://hoangphat.site/cai | bash
 */
header('Content-Type: text/plain; charset=utf-8');

// Tự động phát hiện giao thức (HTTP hoặc HTTPS)
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https" : "http";
$host = $_SERVER['HTTP_HOST'];

// Đường dẫn URL đến thư mục /cai/ hiện tại
$panel_url = $protocol . "://" . $host . dirname($_SERVER['REQUEST_URI']);
$panel_url = rtrim($panel_url, '/\\');

$script_path = __DIR__ . '/install.sh';

if (file_exists($script_path)) {
    $content = file_get_contents($script_path);
    // Thay thế placeholder bằng URL thật của hosting
    $content = str_replace('PANEL_URL_PLACEHOLDER', $panel_url, $content);
    echo $content;
} else {
    echo "# Lỗi: Không tìm thấy tệp install.sh mẫu trên máy chủ trung tâm.\n";
    echo "# Vui lòng đảm bảo tệp install.sh nằm cùng thư mục với index.php.\n";
}
