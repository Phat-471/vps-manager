const fs = require('fs');
const path = require('path');
const archiverModule = require('archiver');
const archiver = typeof archiverModule === 'function' ? archiverModule : archiverModule.default || archiverModule;

// Đường dẫn file zip đầu ra nằm trong thư mục web
const outputZipPath = path.join(__dirname, 'web', 'vps-manager.zip');

// Xóa file zip cũ nếu có
if (fs.existsSync(outputZipPath)) {
    fs.unlinkSync(outputZipPath);
    console.log('Đã xóa vps-manager.zip cũ.');
}

const output = fs.createWriteStream(outputZipPath);
const archive = new archiver.ZipArchive({
    zlib: { level: 9 }
});

output.on('close', function() {
    console.log(`Đóng gói thành công! Tổng dung lượng: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Đã lưu tại: ${outputZipPath}`);
});

archive.on('error', function(err) {
    throw err;
});

archive.pipe(output);

// Danh sách các file và thư mục cần bỏ qua không đóng gói vào zip
const ignoreList = [
    'node_modules',
    'frontend',
    '.git',
    '.github',
    '.agents',
    '.env',
    'web/vps-manager.zip', // không nén đè chính nó
    'package-lock.json',
    'web/data',
    'uploads'
];

function addDirectoryToArchive(dirPath, archivePath = '') {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const relPath = archivePath ? path.join(archivePath, item) : item;
        
        // Chuyển đường dẫn sang dạng chuẩn linux
        const normalizedRelPath = relPath.replace(/\\/g, '/');
        
        // Kiểm tra xem có nằm trong danh sách loại trừ không
        const shouldIgnore = ignoreList.some(ignore => {
            return normalizedRelPath === ignore || normalizedRelPath.startsWith(ignore + '/');
        });
        
        if (shouldIgnore) continue;

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            addDirectoryToArchive(fullPath, relPath);
        } else {
            archive.file(fullPath, { name: normalizedRelPath });
        }
    }
}

console.log('Đang đóng gói mã nguồn...');
addDirectoryToArchive(__dirname);
archive.finalize();
