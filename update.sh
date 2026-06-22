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

echo -e "${YELLOW}1. Đang chuẩn bị mã nguồn & dọn dẹp thay đổi tạm thời...${NC}"
# Lưu các thay đổi cục bộ tạm thời (nếu có) để tránh xung đột khi kéo code mới
HAS_STASH=0
if git status --porcelain | grep -q '^[MADRCU?]'; then
    echo -e "${YELLOW}>> Phát hiện thay đổi cục bộ, đang tạm lưu trữ bằng git stash...${NC}"
    git stash -u >/dev/null 2>&1
    HAS_STASH=1
fi

echo -e "${YELLOW}2. Đang kéo mã nguồn mới nhất từ Git...${NC}"
git fetch --all
git pull origin main --rebase || git pull origin main

if [ "$HAS_STASH" -eq 1 ]; then
    echo -e "${YELLOW}>> Đang khôi phục lại các thay đổi cục bộ...${NC}"
    git stash pop >/dev/null 2>&1 || echo -e "${RED}Cảnh báo: Không thể tự động merge các thay đổi cục bộ cũ. Bạn nên kiểm tra lại bằng lệnh 'git stash pop' thủ công.${NC}"
fi

echo -e "${YELLOW}3. Cập nhật các thư viện thiết yếu (Production Only)...${NC}"
# Sử dụng --omit=dev để chỉ tải các thư viện chạy, bỏ qua thư viện phát triển nặng nề
npm install --omit=dev

echo -e "${YELLOW}4. Khởi động lại ứng dụng qua PM2 để áp dụng thay đổi...${NC}"
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}Đang thực hiện reload ứng dụng bằng PM2 (Zero Downtime)...${NC}"
    pm2 reload vps-manager || pm2 restart vps-manager
    echo -e "${GREEN}Đã khởi động lại tiến trình vps-manager thành công!${NC}"
else
    echo -e "${RED}Cảnh báo: Không tìm thấy PM2. Khởi chạy tạm thời bằng Node thông thường...${NC}"
    npm start &
fi

echo -e "${BLUE}==================================================${NC}"
echo -e "${GREEN}        CẬP NHẬT PANEL THÀNH CÔNG & HOÀN TẤT!      ${NC}"
echo -e "${BLUE}==================================================${NC}"
