#!/bin/bash

# Mã màu hiển thị
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Không màu

echo -e "${BLUE}==================================================${NC}"
echo -e "${GREEN}      TRÌNH CẬP NHẬT VPS MANAGER PANEL TỰ ĐỘNG     ${NC}"
echo -e "${BLUE}==================================================${NC}"

# Kiểm tra quyền root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Lỗi: Vui lòng chạy script này dưới quyền root (sudo bash).${NC}"
  exit 1
fi

# Đi tới thư mục chứa Panel
cd /var/www/vps-manager || exit

# Kiểm tra xem là bản Git hay bản Binary
if [ -d "/var/www/vps-manager/.git" ]; then
    echo -e "${YELLOW}>> Phát hiện chế độ cài đặt từ Nguồn Git. Đang cập nhật...${NC}"
    
    echo -e "${YELLOW}1. Đang dọn dẹp thay đổi tạm thời...${NC}"
    HAS_STASH=0
    if git status --porcelain | grep -q '^[MADRCU?]'; then
        echo -e "${YELLOW}>> Đang tạm lưu trữ bằng git stash...${NC}"
        git stash -u >/dev/null 2>&1
        HAS_STASH=1
    fi
    
    echo -e "${YELLOW}2. Đang kéo mã nguồn mới nhất từ Git...${NC}"
    git fetch --all
    git pull origin main --rebase || git pull origin main
    
    if [ "$HAS_STASH" -eq 1 ]; then
        echo -e "${YELLOW}>> Đang khôi phục lại các thay đổi cục bộ...${NC}"
        git stash pop >/dev/null 2>&1 || echo -e "${RED}Cảnh báo: Không thể tự động merge các thay đổi cục bộ cũ. Bạn nên kiểm tra thủ công.${NC}"
    fi
    
    echo -e "${YELLOW}3. Cập nhật các thư viện thiết yếu (Production Only)...${NC}"
    npm install --omit=dev
    
    echo -e "${YELLOW}4. Khởi động lại ứng dụng để áp dụng thay đổi...${NC}"
    if systemctl is-active --quiet vps-manager; then
        echo -e "${GREEN}Khởi động lại bằng Systemd Service...${NC}"
        systemctl restart vps-manager
    elif command -v pm2 &> /dev/null; then
        echo -e "${GREEN}Khởi động lại bằng PM2...${NC}"
        pm2 reload vps-manager || pm2 restart vps-manager
    else
        echo -e "${GREEN}Khởi chạy trực tiếp bằng Node...${NC}"
        npm start &
    fi
elif [ -f "/var/www/vps-manager/package.json" ]; then
    echo -e "${YELLOW}>> Phát hiện chế độ cài đặt từ Nguồn ZIP. Đang cập nhật...${NC}"
    
    echo -e "${YELLOW}1. Sao lưu cấu hình và dữ liệu cũ...${NC}"
    mkdir -p /tmp/vps_manager_update_bak
    [ -f /var/www/vps-manager/.env ] && cp /var/www/vps-manager/.env /tmp/vps_manager_update_bak/.env
    [ -d /var/www/vps-manager/uploads ] && cp -rf /var/www/vps-manager/uploads /tmp/vps_manager_update_bak/uploads
    
    echo -e "${YELLOW}2. Đang tải ZIP mã nguồn mới từ GitHub...${NC}"
    TMP_ZIP="/tmp/vps-manager-update.zip"
    curl -sSL "https://github.com/Phat-471/vps-manager/archive/refs/heads/main.zip" -o "$TMP_ZIP"
    
    if [ ! -f "$TMP_ZIP" ] || [ ! -s "$TMP_ZIP" ]; then
        echo -e "${RED}Lỗi: Không tải được mã nguồn từ GitHub! Hủy cập nhật.${NC}"
        rm -rf /tmp/vps_manager_update_bak
        exit 1
    fi
    
    echo -e "${YELLOW}3. Đang giải nén mã nguồn mới...${NC}"
    TMP_DIR="/tmp/vps-manager-update-src"
    rm -rf "$TMP_DIR" && mkdir -p "$TMP_DIR"
    unzip -q "$TMP_ZIP" -d "$TMP_DIR"
    rm -f "$TMP_ZIP"
    
    SRC_DIR=$(find "$TMP_DIR" -maxdepth 2 -name "package.json" -exec dirname {} \; | head -n1)
    if [ -z "$SRC_DIR" ]; then
        echo -e "${RED}Lỗi: ZIP tải về không hợp lệ! Hủy cập nhật.${NC}"
        rm -rf /tmp/vps_manager_update_bak "$TMP_DIR"
        exit 1
    fi
    
    echo -e "${YELLOW}4. Cập nhật mã nguồn mới vào thư mục chạy...${NC}"
    cp -rf "$SRC_DIR/"* /var/www/vps-manager/
    rm -rf "$TMP_DIR"
    
    echo -e "${YELLOW}5. Khôi phục cấu hình và dữ liệu...${NC}"
    [ -f /tmp/vps_manager_update_bak/.env ] && cp /tmp/vps_manager_update_bak/.env /var/www/vps-manager/.env
    [ -d /tmp/vps_manager_update_bak/uploads ] && cp -rf /tmp/vps_manager_update_bak/uploads/. /var/www/vps-manager/uploads/ 2>/dev/null
    rm -rf /tmp/vps_manager_update_bak
    
    echo -e "${YELLOW}6. Cập nhật các thư viện thiết yếu (Production Only)...${NC}"
    npm install --omit=dev
    
    echo -e "${YELLOW}7. Khởi động lại ứng dụng để áp dụng thay đổi...${NC}"
    if systemctl is-active --quiet vps-manager; then
        systemctl restart vps-manager
    elif command -v pm2 &> /dev/null; then
        pm2 reload vps-manager || pm2 restart vps-manager
    else
        npm start &
    fi
else
    echo -e "${YELLOW}>> Phát hiện chế độ cài đặt từ Tệp Nhị Phân (Binary). Đang cập nhật...${NC}"
    
    echo -e "${YELLOW}1. Đang kiểm tra phiên bản mới nhất từ Github Releases...${NC}"
    LATEST_RELEASE_JSON=$(curl -s https://api.github.com/repos/Phat-471/vps-manager/releases/latest)
    BINARY_URL=$(echo "$LATEST_RELEASE_JSON" | grep "browser_download_url" | cut -d '"' -f 4 | grep "vps-manager")
    
    if [ -z "$BINARY_URL" ]; then
        # Mặc định fallback nếu không lấy được qua grep
        BINARY_URL="https://github.com/Phat-471/vps-manager/releases/latest/download/vps-manager"
    fi
    
    echo -e "${YELLOW}2. Đang tải tệp nhị phân mới từ: ${BLUE}$BINARY_URL${NC}..."
    wget -q --show-progress -O /usr/local/bin/vps-manager.tmp "$BINARY_URL"
    
    if [ ! -f /usr/local/bin/vps-manager.tmp ] || [ ! -s /usr/local/bin/vps-manager.tmp ]; then
        echo -e "${RED}Lỗi: Tải tệp nhị phân mới thất bại! Hủy bỏ cập nhật.${NC}"
        rm -f /usr/local/bin/vps-manager.tmp
        exit 1
    fi
    
    echo -e "${YELLOW}3. Đang ghi đè và thiết lập quyền cho tệp nhị phân...${NC}"
    mv -f /usr/local/bin/vps-manager.tmp /usr/local/bin/vps-manager
    chmod +x /usr/local/bin/vps-manager
    
    echo -e "${YELLOW}4. Khởi động lại dịch vụ hệ thống vps-manager...${NC}"
    if systemctl is-active --quiet vps-manager; then
        systemctl restart vps-manager
        echo -e "${GREEN}Đã khởi động lại vps-manager.service thành công!${NC}"
    else
        systemctl start vps-manager
        echo -e "${GREEN}Đã khởi chạy lại dịch vụ vps-manager!${NC}"
    fi
fi

echo -e "${BLUE}==================================================${NC}"
echo -e "${GREEN}        CẬP NHẬT PANEL THÀNH CÔNG & HOÀN TẤT!      ${NC}"
echo -e "${BLUE}==================================================${NC}"
