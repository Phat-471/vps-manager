<?php
/**
 * CẤU HÌNH HỆ THỐNG TRUNG TÂM VPS MANAGER
 */

// Cấu hình tài khoản đăng nhập trang quản trị stats.php
// Hỗ trợ cả mật khẩu dạng văn bản trần hoặc chuỗi đã mã hóa Bcrypt (khuyên dùng).
// Để tạo mã hash Bcrypt cho mật khẩu mới, bạn có thể chạy lệnh PHP:
// php -r "echo password_hash('mật_khẩu_của_bạn', PASSWORD_BCRYPT);"

$ADMIN_USER = 'admin';
$ADMIN_PASSWORD = 'admin'; // Quyền tối cao: Xem mật khẩu, tải credentials, xóa lịch sử

$STAFF_USER = 'staff';
$STAFF_PASSWORD = 'staff'; // Quyền giám sát: Chỉ xem biểu đồ và trạng thái, ẩn mật khẩu

// Token bí mật để xác thực các yêu cầu gửi về từ các máy chủ VPS (để tránh giả mạo)
// Bạn nên đổi token này thành một chuỗi ngẫu nhiên bảo mật trước khi sử dụng
$SECURITY_TOKEN = 'vps_secure_token_123';
