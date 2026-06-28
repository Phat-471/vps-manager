#!/bin/bash
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

echo -e "${BLUE}== CẬP NHẬT WEB PANEL TRUNG TÂM ==${NC}"

# Tìm thư mục web root
WEB_DIR=""
for d in /var/www/html /var/www /var/www/html/web; do
    if [ -f "$d/stats.php" ] || [ -f "$d/index.php" ]; then
        WEB_DIR="$d"
        break
    fi
done

if [ -z "$WEB_DIR" ]; then
    echo -e "${RED}Không tìm thấy thư mục web. Vui lòng nhập đường dẫn:${NC}"
    read -r WEB_DIR
fi

echo -e "${YELLOW}Thư mục web: $WEB_DIR${NC}"

# Backup config và data
[ -f "$WEB_DIR/config.php" ] && cp "$WEB_DIR/config.php" /tmp/config.php.bak && echo "✅ Backup config.php"
[ -d "$WEB_DIR/data" ] && cp -rf "$WEB_DIR/data" /tmp/web-data-bak && echo "✅ Backup data/"

# Tải source mới từ GitHub
echo -e "${YELLOW}Đang tải mã nguồn mới từ GitHub...${NC}"
TMP_ZIP="/tmp/vps-web-update.zip"
curl -sSL "https://github.com/Phat-471/vps-manager/archive/refs/heads/main.zip" -o "$TMP_ZIP"

if [ ! -f "$TMP_ZIP" ] || [ ! -s "$TMP_ZIP" ]; then
    echo -e "${RED}Lỗi: Không tải được ZIP từ GitHub!${NC}"; exit 1
fi

TMP_DIR="/tmp/vps-update-src"
rm -rf "$TMP_DIR"; mkdir -p "$TMP_DIR"
unzip -q "$TMP_ZIP" -d "$TMP_DIR"
rm -f "$TMP_ZIP"

# Copy thư mục web/ vào WEB_DIR
SRC_WEB=$(find "$TMP_DIR" -maxdepth 2 -name "stats.php" -exec dirname {} \; | head -n1)
if [ -z "$SRC_WEB" ]; then
    echo -e "${RED}Lỗi: Không tìm thấy thư mục web trong ZIP!${NC}"; exit 1
fi

echo -e "${YELLOW}Đang copy file mới vào $WEB_DIR ...${NC}"
cp -f "$SRC_WEB/"*.php "$WEB_DIR/" 2>/dev/null
cp -f "$SRC_WEB/"*.sh "$WEB_DIR/" 2>/dev/null
cp -f "$SRC_WEB/"*.zip "$WEB_DIR/" 2>/dev/null
rm -rf "$TMP_DIR"

# Khôi phục config và data
[ -f /tmp/config.php.bak ] && cp /tmp/config.php.bak "$WEB_DIR/config.php" && echo "✅ Khôi phục config.php"
[ -d /tmp/web-data-bak ] && cp -rf /tmp/web-data-bak "$WEB_DIR/data" && echo "✅ Khôi phục data/"

chown -R www-data:www-data "$WEB_DIR" 2>/dev/null || true
chmod -R 755 "$WEB_DIR"

echo -e "${GREEN}== CẬP NHẬT HOÀN TẤT! ==${NC}"