<?php
/**
 * API nhận thông số tài nguyên định kỳ gửi về từ VPS
 */
header('Content-Type: application/json; charset=utf-8');

// Thiết lập múi giờ Việt Nam
date_default_timezone_set('Asia/Ho_Chi_Minh');

require_once __DIR__ . '/config.php';

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

$data_dir = __DIR__ . '/data/stats';
if (!is_dir($data_dir)) {
    mkdir($data_dir, 0755, true);
}

// Lấy dữ liệu từ POST request
$input = file_get_contents('php://input');
$payload = json_decode($input, true);

if (!$received_token && isset($payload['token'])) {
    $received_token = $payload['token'];
}

// Xác thực Token bảo mật nếu có cấu hình
if (!empty($SECURITY_TOKEN) && $received_token !== $SECURITY_TOKEN) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Yêu cầu bị từ chối: Token không hợp lệ']);
    exit;
}

if (!$payload || empty($payload['ip'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Dữ liệu không hợp lệ']);
    exit;
}

$ip = $payload['ip'];
$cpu = floatval($payload['cpu'] ?? 0);
$ram = floatval($payload['ram'] ?? 0);
$disk = floatval($payload['disk'] ?? 0);
$rx = floatval($payload['rx'] ?? 0);
$tx = floatval($payload['tx'] ?? 0);

// Xử lý loại bỏ ký tự lạ trong IP làm tên file
$safe_ip = preg_replace('/[^a-zA-Z0-9_.-]/', '', $ip);
$vps_file = $data_dir . '/' . $safe_ip . '.json';

$history = [];
if (file_exists($vps_file)) {
    $history = json_decode(file_get_contents($vps_file), true) ?: [];
}

$now = date('Y-m-d H:i:s');
$history[] = [
    'timestamp' => $now,
    'cpu' => $cpu,
    'ram' => $ram,
    'disk' => $disk,
    'rx' => $rx,
    'tx' => $tx
];

// Giới hạn số lượng bản ghi lưu trữ tối đa: 288 (tương đương 24 giờ gửi mỗi 5 phút)
if (count($history) > 288) {
    $history = array_slice($history, -288);
}

// Lưu tệp stats của VPS
file_put_contents($vps_file, json_encode($history, JSON_PRETTY_PRINT));

echo json_encode(['success' => true]);
