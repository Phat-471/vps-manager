/**
 * Tiện ích bảo mật lọc tham số đầu vào và tránh Shell Command Injection
 */

/**
 * Escape một đối số để truyền an toàn vào lệnh shell Unix/Linux.
 * Bao bọc đối số trong dấu nháy đơn và escape bất kỳ dấu nháy đơn nào bên trong.
 */
function escapeShellArg(arg) {
    if (arg === undefined || arg === null) return "''";
    return "'" + String(arg).replace(/'/g, "'\\''") + "'";
}

/**
 * Chỉ giữ lại các ký tự chữ, số, gạch dưới, gạch ngang và dấu chấm.
 * Thích hợp cho: Container ID, tên Database, tên user, tên dịch vụ.
 */
function sanitizeAlphaNum(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[^a-zA-Z0-9_\-.]/g, '');
}

/**
 * Lọc và ép kiểu thành số nguyên an toàn.
 * Thích hợp cho: Port, index.
 */
function sanitizeNumber(num) {
    const parsed = parseInt(num, 10);
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Lọc chuỗi chỉ cho phép các giao thức firewall an toàn.
 */
function sanitizeProto(proto) {
    const allowed = ['tcp', 'udp', 'any'];
    const p = String(proto).toLowerCase();
    return allowed.includes(p) ? p : 'tcp';
}

function sanitizeAppName(name) {
    if (typeof name !== 'string') return '';
    return name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function isValidIP(ip) {
    if (typeof ip !== 'string') return false;
    // Regex đơn giản để check IPv4 và IPv6 cơ bản
    const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

module.exports = {
    escapeShellArg,
    sanitizeAlphaNum,
    sanitizeNumber,
    sanitizeProto,
    sanitizeAppName,
    isValidIP
};

