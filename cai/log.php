<?php
/**
 * API nhận và ghi nhận nhật ký cài đặt từ VPS gửi về
 */
header('Content-Type: application/json; charset=utf-8');

// Thiết lập múi giờ Việt Nam
date_default_timezone_set('Asia/Ho_Chi_Minh');

$data_dir = __DIR__ . '/data';
if (!is_dir($data_dir)) {
    mkdir($data_dir, 0755, true);
}
$db_file = $data_dir . '/installations.json';

// Lấy dữ liệu thô từ HTTP request body
$input = file_get_contents('php://input');
$payload = json_decode($input, true);

if (!$payload || empty($payload['ip'])) {
    echo json_encode(['success' => false, 'error' => 'Dữ liệu không hợp lệ']);
    exit;
}

$ip = $payload['ip'];
$status = $payload['status'] ?? 'unknown';
$message = $payload['message'] ?? '';
$port = $payload['port'] ?? '';
$password = $payload['password'] ?? '';
$os = $payload['os'] ?? '';

// Đọc danh sách cũ
$list = [];
if (file_exists($db_file)) {
    $list = json_decode(file_get_contents($db_file), true) ?: [];
}

// Tìm index của bản ghi cũ cùng IP
$found_index = -1;
foreach ($list as $idx => $item) {
    if ($item['ip'] === $ip) {
        $found_index = $idx;
        break;
    }
}

$now = date('Y-m-d H:i:s');

if ($found_index !== -1) {
    // Cập nhật bản ghi cũ
    $list[$found_index]['status'] = $status;
    $list[$found_index]['message'] = $message;
    $list[$found_index]['updatedAt'] = $now;
    
    if (!empty($port)) {
        $list[$found_index]['port'] = $port;
    }
    if (!empty($password)) {
        $list[$found_index]['password'] = $password;
    }
    if (!empty($os)) {
        $list[$found_index]['os'] = $os;
    }
    
    // Tính toán thời lượng cài đặt
    if ($status === 'success' && !empty($list[$found_index]['createdAt'])) {
        $start_time = strtotime($list[$found_index]['createdAt']);
        $end_time = strtotime($now);
        $list[$found_index]['duration'] = $end_time - $start_time; // tính theo giây
    }
} else {
    // Thêm bản ghi mới
    $list[] = [
        'id' => 'inst_' . time() . '_' . rand(100, 999),
        'ip' => $ip,
        'port' => $port,
        'password' => $password,
        'status' => $status,
        'message' => $message,
        'os' => $os,
        'createdAt' => $now,
        'updatedAt' => $now,
        'duration' => 0
    ];
}

// Ghi lại tệp tin
file_put_contents($db_file, json_encode($list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo json_encode(['success' => true]);
