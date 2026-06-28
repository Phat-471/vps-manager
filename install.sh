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
IP_VPS=$(curl -s https://api.ipify.org 2>/dev/null || curl -s https://ifconfig.me 2>/dev/null)
if [ -z "$IP_VPS" ]; then
  IP_VPS="IP_CỦA_VPS"
fi

echo -e "${YELLOW}1. Đang cập nhật danh sách gói hệ thống...${NC}"
apt-get update -y

echo -e "${YELLOW}2. Cài đặt các công cụ cơ bản (Curl, Wget, Unzip, Git, Node.js)...${NC}"
apt-get install -y curl wget unzip ufw git

# Cài đặt Node.js nếu chưa có
if ! command -v node &>/dev/null; then
    echo -e "${YELLOW}>> Đang thiết lập môi trường NodeJS 18...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi
echo -e "${GREEN}Node.js đã sẵn sàng: $(node -v)${NC}"

# Tạo thư mục làm việc
mkdir -p /var/www/vps-manager
mkdir -p /var/www/vps-manager/uploads

echo -e "${YELLOW}3. Đang tải mã nguồn VPS Manager từ GitHub...${NC}"

# Sao lưu cấu hình cũ nếu có
REUSE_CONFIG="n"
if [ -f /var/www/vps-manager/.env ]; then
    EXISTING_PORT=$(grep -E "^PORT=" /var/www/vps-manager/.env | cut -d'=' -f2)
    EXISTING_PW=$(grep -E "^PANEL_PASSWORD=" /var/www/vps-manager/.env | cut -d'=' -f2)
    if [ -n "$EXISTING_PORT" ] && [ -n "$EXISTING_PW" ]; then
        echo -e "${YELLOW}>> Phát hiện cấu hình cũ (Port: $EXISTING_PORT).${NC}"
        echo -n "Bạn có muốn giữ lại Port và Mật khẩu Panel cũ không? (y/n, mặc định y): "
        read -r REUSE_DECISION < /dev/tty
        if [ -z "$REUSE_DECISION" ] || [ "$REUSE_DECISION" = "y" ] || [ "$REUSE_DECISION" = "Y" ]; then
            REUSE_CONFIG="y"
            mkdir -p /tmp/vps_manager_bak
            cp /var/www/vps-manager/.env /tmp/vps_manager_bak/.env
            [ -d /var/www/vps-manager/uploads ] && cp -rf /var/www/vps-manager/uploads /tmp/vps_manager_bak/uploads
        fi
    fi
fi

# Tải ZIP mã nguồn mới nhất từ nhánh main trên GitHub (KHÔNG cần tạo Release thủ công)
TMP_ZIP="/tmp/vps-manager-install.zip"
TMP_SRC="/tmp/vps-manager-src"
echo -e "${BLUE}>> Đang tải mã nguồn từ GitHub (nhánh main)...${NC}"
curl -sSL "https://github.com/Phat-471/vps-manager/archive/refs/heads/main.zip" -o "$TMP_ZIP"

if [ ! -f "$TMP_ZIP" ] || [ ! -s "$TMP_ZIP" ]; then
    echo -e "${RED}Lỗi: Không tải được mã nguồn từ GitHub! Vui lòng kiểm tra kết nối mạng.${NC}"
    exit 1
fi

echo -e "${YELLOW}>> Đang giải nén mã nguồn...${NC}"
rm -rf "$TMP_SRC"
mkdir -p "$TMP_SRC"
unzip -q "$TMP_ZIP" -d "$TMP_SRC"
rm -f "$TMP_ZIP"

# Tìm thư mục gốc giải nén (thường là vps-manager-main/)
SRC_DIR=$(find "$TMP_SRC" -maxdepth 1 -type d | grep -v "^$TMP_SRC$" | head -n1)
if [ -z "$SRC_DIR" ]; then
    echo -e "${RED}Lỗi: Không tìm thấy mã nguồn trong gói tải về! Hủy cài đặt.${NC}"
    rm -rf "$TMP_SRC"
    exit 1
fi

# Sao chép mã nguồn vào thư mục cài đặt
cp -rf "$SRC_DIR/." /var/www/vps-manager/
rm -rf "$TMP_SRC"

# Khôi phục cấu hình cũ nếu người dùng chọn giữ lại
if [ "$REUSE_CONFIG" = "y" ] && [ -f /tmp/vps_manager_bak/.env ]; then
    cp /tmp/vps_manager_bak/.env /var/www/vps-manager/.env
    [ -d /tmp/vps_manager_bak/uploads ] && cp -rf /tmp/vps_manager_bak/uploads/. /var/www/vps-manager/uploads/ 2>/dev/null
    rm -rf /tmp/vps_manager_bak
fi

echo -e "${YELLOW}>> Đang cài đặt các thư viện Node.js (Production Only)...${NC}"
cd /var/www/vps-manager || exit
npm install --omit=dev
cd - >/dev/null || exit

echo -e "${YELLOW}4. Thiết lập cấu hình mạng & mật khẩu bảo vệ Panel...${NC}"

if [ "$REUSE_CONFIG" = "y" ]; then
    PORT="$EXISTING_PORT"
    PANEL_PW="$EXISTING_PW"
    echo -e "${GREEN}>> Đã khôi phục cấu hình cũ thành công (Port: $PORT)!${NC}"
else
    # Tìm port ngẫu nhiên chưa sử dụng
    echo -e "Đang quét cổng trống trên hệ thống..."
    while true; do
        RANDOM_PORT=$((10000 + RANDOM % 55000))
        PORT_IN_USE=0
        if command -v ss &>/dev/null; then
            if ss -tuln 2>/dev/null | grep -q ":$RANDOM_PORT "; then
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

    echo -e "Cổng đề xuất (ngẫu nhiên): ${GREEN}$RANDOM_PORT${NC}"
    echo -e "Nhập cổng bạn muốn dùng (Nhấn Enter để dùng cổng đề xuất: $RANDOM_PORT):"
    # Đọc từ /dev/tty để hoạt động đúng khi chạy qua curl | bash
    read -r INPUT_PORT < /dev/tty
    if [ -n "$INPUT_PORT" ] && [[ "$INPUT_PORT" =~ ^[0-9]+$ ]]; then
        PORT="$INPUT_PORT"
    else
        PORT="$RANDOM_PORT"
    fi

    echo -e "Nhập mật khẩu Panel (tối thiểu 6 ký tự, nhấn Enter để tạo ngẫu nhiên):"
    # Đọc từ /dev/tty để hoạt động đúng khi chạy qua curl | bash
    read -r -s PANEL_PW < /dev/tty
    echo
    if [ -z "$PANEL_PW" ]; then
        PANEL_PW=$(head /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 12)
        echo -e "${GREEN}Mật khẩu ngẫu nhiên được tạo: $PANEL_PW${NC}"
    else
        while [ ${#PANEL_PW} -lt 6 ]; do
            echo -e "${RED}Mật khẩu quá ngắn, vui lòng nhập lại (Tối thiểu 6 ký tự):${NC}"
            read -r -s PANEL_PW < /dev/tty
            echo
        done
    fi
fi

# Ghi cấu hình vào .env
echo "PANEL_PASSWORD=$PANEL_PW" > /var/www/vps-manager/.env
echo "PORT=$PORT" >> /var/www/vps-manager/.env
echo -e "${GREEN}Đã cấu hình cổng $PORT và mật khẩu Panel thành công!${NC}"

# Tạo Systemd Service
echo -e "${YELLOW}5. Cấu hình Dịch vụ Hệ thống (Systemd Service)...${NC}"
cat <<EOF > /etc/systemd/system/vps-manager.service
[Unit]
Description=VPS Manager Panel Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/vps-manager
ExecStart=/usr/bin/node server/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl stop vps-manager 2>/dev/null || true
systemctl enable vps-manager
systemctl start vps-manager

echo -e "${YELLOW}6. Mở cổng $PORT trên Tường lửa UFW...${NC}"
if command -v ufw &>/dev/null; then
    ufw allow "$PORT"/tcp
    ufw reload 2>/dev/null || true
fi

echo -e "${BLUE}==================================================${NC}"
echo -e "${GREEN}       CÀI ĐẶT VPS MANAGER PANEL HOÀN TẤT!        ${NC}"
echo -e "${BLUE}==================================================${NC}"
INSTALL_LINK="http://${IP_VPS}:${PORT}/?password=${PANEL_PW}"

echo -e "Địa chỉ truy cập Panel: ${GREEN}http://${IP_VPS}:${PORT}${NC}"
echo -e "Mật khẩu bảo vệ:       ${YELLOW}${PANEL_PW}${NC}"
echo -e "Liên kết đăng nhập nhanh: ${GREEN}${INSTALL_LINK}${NC}"
echo -e "${BLUE}--------------------------------------------------${NC}"
echo -e "${RED}LƯU Ý QUAN TRỌNG:${NC}"
echo -e "1. Hãy sao chép và lưu lại thông tin đăng nhập trên."
echo -e "2. Đảm bảo mở cổng ${GREEN}${PORT}${NC} trong Firewall của nhà cung cấp VPS."
echo -e "3. Cập nhật phần mềm: Vào Panel -> Bảo trì hệ thống -> Cập nhật Panel ngay"
echo -e "   (Từ nay hoàn toàn tự động, không cần làm thủ công!)"
echo -e "4. Quản lý trạng thái Panel:"
echo -e "   👉 Xem log:         ${BLUE}journalctl -u vps-manager -n 50${NC}"
echo -e "   👉 Khởi động lại:   ${BLUE}systemctl restart vps-manager${NC}"
echo -e "   👉 Dừng hoạt động:  ${BLUE}systemctl stop vps-manager${NC}"
echo -e "${BLUE}==================================================${NC}"
