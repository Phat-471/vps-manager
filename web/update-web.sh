#!/bin/bash
# Script cập nhật Web Panel trung tâm (hoangphat.site)
# Chạy trên chính máy chủ web khi cần cập nhật

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

WEB_DIR="/var/www/html"  # Thư mục web root (thay đổi nếu khác)

echo -e "${BLUE}==================================================${NC}"
echo -e "${GREEN}    CẬP NHẬT WEB PANEL TRUNG TÂM TỪ GIT         ${NC}"
echo -e "${BLUE}==================================================${NC}"

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Lỗi: Vui lòng chạy script này dưới quyền root (sudo bash).${NC}"
  exit 1
fi

# Backup config.php và data/ trước khi cập nhật
echo -e "${YELLOW}1. Backup cấu hình và dữ liệu quan trọng...${NC}"
cp -f "$WEB_DIR/config.php" /tmp/config.php.bak 2>/dev/null && echo -e "${GREEN}  Đã backup config.php${NC}" || echo -e "${YELLOW}  Không tìm thấy config.php cũ (bỏ qua)${NC}"

if [ -d "$WEB_DIR/data" ]; then
    cp -rf "$WEB_DIR/data" /tmp/web-data-bak 2>/dev/null
    echo -e "${GREEN}  Đã backup thư mục data/${NC}"
fi

# Kiểm tra git hoặc tải trực tiếp
echo -e "${YELLOW}2. Đang cập nhật mã nguồn web...${NC}"
if [ -d "$WEB_DIR/.git" ]; then
    cd "$WEB_DIR" || exit
    git fetch --all
    git reset --hard origin/main
    git pull origin main
    echo -e "${GREEN}  Đã cập nhật từ Git thành công!${NC}"
else
    echo -e "${YELLOW}  Không phát hiện Git repo. Đang tải từ GitHub...${NC}"
    TMP_DIR=$(mktemp -d)
    git clone --depth=1 https://github.com/Phat-471/vps-manager.git "$TMP_DIR"
    
    # Chỉ copy thư mục web/
    if [ -d "$TMP_DIR/web" ]; then
        # Giữ lại config.php và data/
        cp -rf "$TMP_DIR/web/"* "$WEB_DIR/"
        echo -e "${GREEN}  Đã copy mã nguồn web mới thành công!${NC}"
    fi
    rm -rf "$TMP_DIR"
fi

# Khôi phục config.php và data/
echo -e "${YELLOW}3. Khôi phục cấu hình và dữ liệu...${NC}"
if [ -f /tmp/config.php.bak ]; then
    cp -f /tmp/config.php.bak "$WEB_DIR/config.php"
    echo -e "${GREEN}  Đã khôi phục config.php${NC}"
fi

if [ -d /tmp/web-data-bak ]; then
    cp -rf /tmp/web-data-bak "$WEB_DIR/data"
    echo -e "${GREEN}  Đã khôi phục thư mục data/${NC}"
fi

# Phân quyền
chown -R www-data:www-data "$WEB_DIR" 2>/dev/null || true
chmod -R 755 "$WEB_DIR"
chmod 600 "$WEB_DIR/config.php" 2>/dev/null || true

echo -e "${BLUE}==================================================${NC}"
echo -e "${GREEN}      CẬP NHẬT WEB PANEL HOÀN TẤT!              ${NC}"
echo -e "${BLUE}==================================================${NC}"
