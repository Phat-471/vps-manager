#!/bin/bash

# Mã màu hiển thị
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Không màu

echo -e "${BLUE}==================================================${NC}"
echo -e "${GREEN}       HỆ THỐNG CỨU HỘ VPS MANAGER PANEL KHẨN CẤP  ${NC}"
echo -e "${BLUE}==================================================${NC}"

# Kiểm tra quyền root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Lỗi: Vui lòng chạy script này dưới quyền root (sudo bash).${NC}"
  exit 1
fi

echo -e "${YELLOW}>> 1. Đang dừng dịch vụ lỗi hiện tại...${NC}"
systemctl stop vps-manager >/dev/null 2>&1
pm2 stop vps-manager >/dev/null 2>&1 || true

# Kiểm tra bản backup rollback có sẵn không
ROLLBACK_DIR="/var/www/vps-manager-rollback-bak"
if [ -d "$ROLLBACK_DIR" ]; then
    echo -e "${GREEN}>> 2. Phát hiện bản sao lưu rollback cục bộ. Đang khôi phục...${NC}"
    rm -rf /var/www/vps-manager/*
    cp -rf "$ROLLBACK_DIR"/* /var/www/vps-manager/
    rm -rf "$ROLLBACK_DIR"
    
    echo -e "${YELLOW}>> 3. Cài đặt lại thư viện phụ thuộc...${NC}"
    cd /var/www/vps-manager && npm install --omit=dev
else
    echo -e "${YELLOW}>> 2. Không có bản sao lưu cục bộ. Tiến hành tải bản Stable mới nhất...${NC}"
    mkdir -p /var/www/vps-manager
    cd /var/www/vps-manager
    
    # Lưu .env cũ
    [ -f .env ] && cp .env /tmp/vps_manager_rescue_env
    
    TMP_ZIP="/tmp/vps-manager-rescue.zip"
    curl -sSL "https://github.com/Phat-471/vps-manager/archive/refs/heads/main.zip" -o "$TMP_ZIP"
    
    if [ -f "$TMP_ZIP" ] && [ -s "$TMP_ZIP" ]; then
        TMP_DIR="/tmp/vps-manager-rescue-src"
        rm -rf "$TMP_DIR" && mkdir -p "$TMP_DIR"
        unzip -q "$TMP_ZIP" -d "$TMP_DIR"
        rm -f "$TMP_ZIP"
        
        SRC_DIR=$(find "$TMP_DIR" -maxdepth 2 -name "package.json" -exec dirname {} \; | head -n1)
        if [ -n "$SRC_DIR" ]; then
            cp -rf "$SRC_DIR/"* /var/www/vps-manager/
            echo -e "${GREEN}>> Đã tải và cài mã nguồn Stable sạch.${NC}"
        fi
        rm -rf "$TMP_DIR"
    else
        echo -e "${RED}Lỗi: Không tải được mã nguồn cứu hộ từ GitHub!${NC}"
        exit 1
    fi
    
    # Khôi phục .env
    [ -f /tmp/vps_manager_rescue_env ] && mv -f /tmp/vps_manager_rescue_env .env
    
    echo -e "${YELLOW}>> 3. Cài đặt các thư viện thiết yếu...${NC}"
    npm install --omit=dev
fi

echo -e "${YELLOW}>> 4. Khởi động lại dịch vụ...${NC}"
if [ -f "/etc/systemd/system/vps-manager.service" ]; then
    systemctl daemon-reload
    systemctl start vps-manager
    systemctl enable vps-manager
elif command -v pm2 &> /dev/null; then
    pm2 start server/server.js --name "vps-manager" || pm2 restart vps-manager
else
    npm start &
fi

echo -e "${YELLOW}>> 5. Đang kiểm tra trạng thái khởi chạy...${NC}"
sleep 3
if systemctl is-active --quiet vps-manager || pm2 describe vps-manager 2>/dev/null | grep -q "online" || kill -0 $(jobs -p) 2>/dev/null; then
    echo -e "${BLUE}==================================================${NC}"
    echo -e "${GREEN}    HỒI SINH PANEL THÀNH CÔNG! HỆ THỐNG ĐÃ ONLINE. ${NC}"
    echo -e "${GREEN}    Vui lòng thử truy cập lại giao diện Web Panel.  ${NC}"
    echo -e "${BLUE}==================================================${NC}"
else
    echo -e "${RED}Lỗi: Không thể khởi động dịch vụ sau khi cứu hộ. Vui lòng kiểm tra log hệ thống: journalctl -u vps-manager${NC}"
fi
