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

module.exports = {
    escapeShellArg,
    sanitizeAlphaNum,
    sanitizeNumber,
    sanitizeProto
};
