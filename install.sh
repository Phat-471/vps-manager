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

echo -e "${YELLOW}2. Cài đặt các công cụ cơ bản (Curl, Wget)...${NC}"
apt-get install -y curl wget unzip ufw

# Tạo thư mục làm việc cố định cho Panel
mkdir -p /var/www/vps-manager
mkdir -p /var/www/vps-manager/uploads

# Tải tệp nhị phân đã biên dịch sẵn
echo -e "${YELLOW}3. Đang tải tệp nhị phân VPS Manager đã biên dịch sẵn...${NC}"
BINARY_URL="https://github.com/Phat-471/vps-manager/releases/latest/download/vps-manager"

echo -e "Nhập link tải tệp nhị phân (Bấm Enter để dùng mặc định từ Github: $BINARY_URL):"
read -r INPUT_URL
if [ -n "$INPUT_URL" ]; then
    BINARY_URL="$INPUT_URL"
fi

echo -e "Đang tải xuống từ: ${BLUE}$BINARY_URL${NC}..."
wget -q --show-progress -O /usr/local/bin/vps-manager "$BINARY_URL"

if [ ! -f /usr/local/bin/vps-manager ]; then
    echo -e "${RED}Lỗi: Không thể tải tệp nhị phân. Vui lòng kiểm tra lại đường dẫn link tải.${NC}"
    exit 1
fi

chmod +x /usr/local/bin/vps-manager
echo -e "${GREEN}Đã cài đặt tệp nhị phân tại /usr/local/bin/vps-manager${NC}"

echo -e "${YELLOW}4. Thiết lập cấu hình mạng & mật khẩu bảo vệ Panel...${NC}"
# Tìm một port ngẫu nhiên chưa sử dụng từ 10000 - 65000
echo -e "Đang quét cổng (port) trống trên hệ thống..."
while true; do
    RANDOM_PORT=$((10000 + RANDOM % 55000))
    PORT_IN_USE=0
    if command -v ss &>/dev/null; then
        if ss -tuln 2>/dev/null | grep -q -E ":$RANDOM_PORT\b|:$RANDOM_PORT$" || ss -tuln 2>/dev/null | grep -q ":$RANDOM_PORT "; then
            PORT_IN_USE=1
        fi
    else
        HEX_PORT=$(printf '%04X' $RANDOM_PORT)
        if grep -q -i ":$HEX_PORT " /proc/net/tcp /proc/net/tcp6 2>/dev/null; then
            PORT_IN_USE=1
        fi
    fi
    if [ "$PORT_IN_USE" -eq 0 ]; then
        break
    fi
done

echo -e "Chúng tôi đề xuất chạy Panel trên cổng ngẫu nhiên bảo mật: ${GREEN}$RANDOM_PORT${NC}"
echo -e "Nhập cổng bạn muốn sử dụng (Bấm Enter để dùng cổng đề xuất: $RANDOM_PORT):"
read -r INPUT_PORT
if [ -n "$INPUT_PORT" ] && [[ "$INPUT_PORT" =~ ^[0-9]+$ ]]; then
    PORT="$INPUT_PORT"
else
    PORT="$RANDOM_PORT"
fi

echo -e "Nhập mật khẩu Panel bạn muốn đặt (Tối thiểu 6 ký tự, nhập ẩn, bấm Enter để tự động tạo):"
read -r -s PANEL_PW
if [ -z "$PANEL_PW" ]; then
    PANEL_PW=$(head /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 12)
    echo -e "${GREEN}Mật khẩu ngẫu nhiên được tạo tự động: $PANEL_PW${NC}"
else
    while [ ${#PANEL_PW} -lt 6 ]; do
        echo -e "${RED}Mật khẩu quá ngắn, vui lòng nhập lại (Tối thiểu 6 ký tự):${NC}"
        read -r -s PANEL_PW
    done
fi

# Ghi cấu hình vào .env trong thư mục làm việc
echo "PANEL_PASSWORD=$PANEL_PW" > /var/www/vps-manager/.env
echo "PORT=$PORT" >> /var/www/vps-manager/.env
echo -e "${GREEN}Đã cấu hình cổng $PORT và mật khẩu Panel thành công!${NC}"

# Tạo service Systemd để tự khởi động và tự phục hồi
echo -e "${YELLOW}5. Cấu hình Dịch vụ Hệ thống (Systemd Service)...${NC}"
cat <<EOF > /etc/systemd/system/vps-manager.service
[Unit]
Description=VPS Manager Panel Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/vps-manager
ExecStart=/usr/local/bin/vps-manager
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Nạp lại cấu hình và chạy service
systemctl daemon-reload
systemctl stop vps-manager 2>/dev/null || true
systemctl enable vps-manager
systemctl start vps-manager

echo -e "${YELLOW}6. Mở cổng $PORT trên Tường lửa UFW...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow "$PORT"/tcp
    ufw reload
fi

echo -e "${BLUE}==================================================${NC}"
echo -e "${GREEN}       CÀI ĐẶT VPS MANAGER PANEL HOÀN TẤT!        ${NC}"
echo -e "${BLUE}==================================================${NC}"
INSTALL_LINK="http://${IP_VPS}:${PORT}/?password=${PANEL_PW}"

echo -e "Địa chỉ truy cập Panel: ${GREEN}http://${IP_VPS}:${PORT}${NC}"
echo -e "Tài khoản đăng nhập:    ${YELLOW}admin${NC}"
echo -e "Mật khẩu bảo vệ:       ${YELLOW}${PANEL_PW}${NC}"
echo -e "Liên kết đăng nhập tự động: ${GREEN}${INSTALL_LINK}${NC}"
echo -e "${BLUE}--------------------------------------------------${NC}"
echo -e "${RED}LƯU Ý QUAN TRỌNG:${NC}"
echo -e "1. Hãy sao chép và lưu lại thông tin đăng nhập trên."
2. Đảm bảo mở cổng ${GREEN}${PORT}${NC} trong cấu hình Firewall của nhà cung cấp VPS.
3. Quản lý trạng thái Panel qua Systemd:
   👉 Xem log hoạt động:  ${BLUE}journalctl -u vps-manager -n 50${NC}
   👉 Khởi động lại:      ${BLUE}systemctl restart vps-manager${NC}
   👉 Dừng hoạt động:     ${BLUE}systemctl stop vps-manager${NC}
${BLUE}==================================================${NC}
