#!/bin/bash

# Mã màu hiển thị
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Không màu

echo -e "${BLUE}==================================================${NC}"
echo -e "${GREEN}      TRÌNH CÀI ĐẶT VPS MANAGER PANEL TỰ ĐỘNG      ${NC}"
echo -e "${BLUE}==================================================${NC}"

# Kiểm tra quyền root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Lỗi: Vui lòng chạy script này dưới quyền root (sudo bash).${NC}"
  exit 1
fi

# Lấy IP Public của VPS
IP_VPS=$(curl -s https://api.ipify.org || curl -s https://ifconfig.me)
if [ -z "$IP_VPS" ]; then
  IP_VPS="IP_CỦA_VPS"
fi

echo -e "${YELLOW}1. Đang cập nhật danh sách gói hệ thống...${NC}"
apt-get update -y

echo -e "${YELLOW}2. Cài đặt các công cụ cơ bản (Git, Curl, Wget)...${NC}"
apt-get install -y git curl wget unzip

echo -e "${YELLOW}3. Cài đặt Node.js & NPM (Phiên bản LTS)...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo -e "${GREEN}Node.js đã được cài đặt: $(node -v)${NC}"
fi

echo -e "${YELLOW}4. Đang cài đặt mã nguồn VPS Manager...${NC}"
# Tạo thư mục và tải code từ Git
# LƯU Ý: Hãy thay thế đường dẫn Git này bằng repository thực tế của bạn sau khi bạn đẩy code lên Git của bạn.
GIT_REPO="https://github.com/YOUR_USERNAME/vps-manager.git"

echo -e "Nhập link Git chứa code của bạn (Bấm Enter để dùng mặc định: $GIT_REPO):"
read -r INPUT_REPO
if [ -n "$INPUT_REPO" ]; then
    GIT_REPO="$INPUT_REPO"
fi

rm -rf /var/www/vps-manager
echo -e "Đang tải mã nguồn từ: ${BLUE}$GIT_REPO${NC}..."
git clone "$GIT_REPO" /var/www/vps-manager

if [ ! -d /var/www/vps-manager ]; then
    echo -e "${RED}Lỗi: Không thể tải mã nguồn từ Git. Vui lòng kiểm tra lại link Git hoặc chế độ công khai (Public) của repo.${NC}"
    exit 1
fi

cd /var/www/vps-manager || exit

echo -e "${YELLOW}5. Đang cài đặt thư viện Backend...${NC}"
npm install

echo -e "${YELLOW}6. Đang cài đặt và biên dịch giao diện Frontend...${NC}"
cd frontend || exit
npm install
npm run build
cd ..

echo -e "${YELLOW}7. Thiết lập mật khẩu bảo vệ Panel truy cập từ xa...${NC}"
echo -e "Bạn có muốn đặt mật khẩu đăng nhập bảo vệ cho Panel từ xa không? (y/n)"
read -r SET_PASS
if [[ "$SET_PASS" =~ ^[Yy]$ ]]; then
    echo -e "Nhập mật khẩu bạn muốn đặt (Tối thiểu 6 ký tự):"
    read -r -s PANEL_PW
    while [ ${#PANEL_PW} -lt 6 ]; do
        echo -e "${RED}Mật khẩu quá ngắn, vui lòng nhập lại (Tối thiểu 6 ký tự):${NC}"
        read -r -s PANEL_PW
    done
    echo "PANEL_PASSWORD=$PANEL_PW" > /var/www/vps-manager/.env
    echo "PORT=3000" >> /var/www/vps-manager/.env
    echo -e "${GREEN}Đã cấu hình mật khẩu Panel thành công!${NC}"
else
    echo -e "${YELLOW}Cảnh báo: Bạn đã chọn KHÔNG đặt mật khẩu. Panel sẽ mở tự do cho bất kỳ ai truy cập.${NC}"
    echo "PORT=3000" > /var/www/vps-manager/.env
fi

echo -e "${YELLOW}8. Cài đặt PM2 và thiết lập chạy nền...${NC}"
npm install -g pm2
pm2 delete vps-manager 2>/dev/null || true
pm2 start server/server.js --name "vps-manager"
pm2 save

# Cấu hình tự khởi động PM2 khi reboot VPS
pm2 startup | tail -n 1 | bash

echo -e "${YELLOW}9. Mở cổng 3000 trên Tường lửa UFW...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 3000/tcp
    ufw reload
fi

echo -e "${BLUE}==================================================${NC}"
echo -e "${GREEN}       CÀI ĐẶT VPS MANAGER PANEL HOÀN TẤT!        ${NC}"
echo -e "${BLUE}==================================================${NC}"
if [[ "$SET_PASS" =~ ^[Yy]$ ]]; then
    echo -e "Địa chỉ truy cập từ xa: ${GREEN}http://${IP_VPS}:3000${NC}"
    echo -e "Mật khẩu bảo vệ: ${YELLOW}Đã được thiết lập bí mật${NC}"
else
    echo -e "Địa chỉ truy cập từ xa: ${GREEN}http://${IP_VPS}:3000${NC}"
    echo -e "Trạng thái bảo mật: ${RED}Cảnh báo - Không có mật khẩu${NC}"
fi
echo -e "Lưu ý: Mở cổng 3000 trên cấu hình Firewall nhà cung cấp VPS nếu có (như AWS, Google Cloud)."
echo -e "${BLUE}==================================================${NC}"
