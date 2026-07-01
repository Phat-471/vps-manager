const fs = require('fs');

const mockIni = `
; php.ini mock
memory_limit = 128M
upload_max_filesize = 2M
post_max_size = 8M
`;

fs.writeFileSync('mock_php.ini', mockIni);

const key = 'upload_max_filesize';
const val = '5M';

// Try standard replacement logic
let content = fs.readFileSync('mock_php.ini', 'utf8');

// Simulate the bash sed command on Windows / Node
const regex = new RegExp(`^[[:space:]]*${key}[[:space:]]*=.*`, 'm');
console.log('Regex matches:', regex.test(content));

const replaced = content.replace(new RegExp(`(^[\\s]*${key}[\\s]*=).*`, 'm'), `$1 = ${val}`);
console.log('Replaced content:\n', replaced);
fs.unlinkSync('mock_php.ini');
