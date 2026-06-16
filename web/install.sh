#!/bin/bash

# Mã màu hiển thị
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Không màu

# URL của Web Panel trung tâm (Sẽ được index.php thay thế tự động khi tải về)
PANEL_URL="PANEL_URL_PLACEHOLDER"
# Token xác thực bảo mật với Web Panel trung tâm (Sẽ được index.php thay thế)
TOKEN="SECURITY_TOKEN_PLACEHOLDER"

echo -e "${BLUE}==================================================${NC}"
echo -e "${GREEN}      TRÌNH CÀI ĐẶT VPS MANAGER PANEL TỰ ĐỘNG      ${NC}"
echo -e "${BLUE}==================================================${NC}"

# Kiểm tra chạy bằng bash
if [ -z "$BASH_VERSION" ]; then
  echo -e "\033[0;31mLỗi: Script này phải được chạy bằng bash, không phải sh.\033[0m"
  echo -e "Vui lòng chạy lại bằng lệnh: \033[0;32mcurl -sSL https://hoangphat.site/web | bash\033[0m"
  exit 1
fi

# Kiểm tra quyền root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Lỗi: Vui lòng chạy script này dưới quyền root (sudo bash).${NC}"
  exit 1
fi

# Kiểm tra bộ nhớ RAM và cấu hình Swap nếu RAM quá thấp (< 1.5GB) và không có Swap đủ lớn
if [ -f /proc/meminfo ]; then
  TOTAL_RAM=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
  TOTAL_SWAP=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
  
  # Luôn đề xuất tạo Swap nếu tổng lượng Swap nhỏ hơn 1GB để cài đặt không bị OOM Killed
  if [ -z "$TOTAL_SWAP" ] || [ "$TOTAL_SWAP" -lt 1000 ]; then
    echo -e "${YELLOW}Cảnh báo: VPS của bạn chưa có đủ bộ nhớ ảo Swap ($TOTAL_SWAP MB) (RAM hiện tại: $TOTAL_RAM MB).${NC}"
    echo -e "${YELLOW}Điều này dễ khiến hệ điều hành tự động tắt tiến trình (Killed) khi cập nhật hoặc cài PM2/Node.js.${NC}"
    echo -n "Bạn có muốn tự động tạo/tăng tệp Swap lên 1GB để cài đặt ổn định hơn không? (y/n): "
    if [ -t 0 ]; then
      read -r SWAP_DECISION
    elif [ -c /dev/tty ]; then
      read -r SWAP_DECISION </dev/tty
    else
      SWAP_DECISION="y"
    fi
    if [ "$SWAP_DECISION" = "y" ] || [ "$SWAP_DECISION" = "Y" ]; then
      echo -e "${BLUE}Đang khởi tạo tệp Swap 1GB...${NC}"
      # Tắt swap cũ nếu trùng tên tệp tin để tránh lỗi ghi đè hoạt động
      swapoff /swapfile 2>/dev/null || true
      fallocate -l 1G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=1024 2>/dev/null
      chmod 600 /swapfile
      mkswap /swapfile >/dev/null
      swapon /swapfile >/dev/null
      if grep -q "/swapfile" /etc/fstab; then
        echo -e "${GREEN}Đã ghi nhận Swap trong cấu hình khởi động.${NC}"
      else
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
      fi
      echo -e "${GREEN}Đã kích hoạt Swap 1GB thành công!${NC}"
    else
      echo -e "${YELLOW}Bỏ qua cấu hình Swap. Quá trình cài đặt tiếp tục...${NC}"
    fi
  fi
fi

# Lấy IP Public của VPS
IP_VPS=$(curl -k -s https://api.ipify.org || curl -k -s https://ifconfig.me)
if [ -z "$IP_VPS" ]; then
  IP_VPS="IP_CỦA_VPS"
fi

OS_VERSION=$(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '"')
if [ -z "$OS_VERSION" ]; then
  OS_VERSION="Linux OS"
fi

# Hàm gửi báo cáo trạng thái về máy chủ trung tâm
report_status() {
    local status="$1"
    local msg="$2"
    local port="$3"
    local pw="$4"
    local os_name="$5"
    
    if [ -n "$PANEL_URL" ] && [ "$PANEL_URL" != "PANEL_URL_""PLACEHOLDER" ]; then
        echo -e "${BLUE}Đang gửi báo cáo trạng thái về Web Panel: $status...${NC}"
        # Thực hiện gọi curl, lưu lại cả HTTP status code và response body
        local res
        res=$(curl -k -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$PANEL_URL/log.php" \
             -H "Content-Type: application/json" \
             -H "X-Secure-Token: $TOKEN" \
             -d "{\"ip\":\"$IP_VPS\",\"status\":\"$status\",\"message\":\"$msg\",\"port\":\"$port\",\"password\":\"$pw\",\"os\":\"$os_name\"}")
             
        local http_code
        http_code=$(echo "$res" | grep "HTTP_STATUS" | cut -d':' -f2)
        local body
        body=$(echo "$res" | grep -v "HTTP_STATUS")
        
        if [ "$http_code" -ne 200 ]; then
            echo -e "${RED}Lỗi gửi báo cáo lên Web: HTTP $http_code. Chi tiết phản hồi: $body${NC}"
        elif echo "$body" | grep -q '"success":true'; then
            echo -e "${GREEN}Gửi báo cáo lên Web thành công.${NC}"
        else
            echo -e "${RED}Lỗi xử lý phía Web (HTTP 200 nhưng thất bại): $body${NC}"
        fi
    fi
}

# Báo cáo bắt đầu cài đặt
report_status "installing" "Bắt đầu cài đặt VPS Manager Panel..." "" "" "$OS_VERSION"

# Bẫy lỗi cài đặt để báo cáo thất bại
error_handler() {
    local line=$1
    report_status "failed" "Lỗi xảy ra tại dòng lệnh số $line" "" "" "$OS_VERSION"
    echo -e "${RED}Cài đặt thất bại tại dòng số $line. Đã báo cáo về hệ thống trung tâm.${NC}"
    exit 1
}
trap 'error_handler $LINENO' ERR

echo -e "${YELLOW}1. Đang cập nhật danh sách gói hệ thống...${NC}"
apt-get update -y

echo -e "${YELLOW}2. Cài đặt các công cụ cơ bản (Git, Curl, Wget, Cron)...${NC}"
# Giải phóng thuộc tính chống ghi (immutable) nếu có trên các thư mục/tệp tin hệ thống
if command -v chattr &>/dev/null; then
    chattr -R -i /usr/bin /usr/sbin /bin /sbin 2>/dev/null || true
    chattr -i /usr/bin/wget /usr/bin/curl /usr/bin/git /usr/bin/unzip /usr/bin/funzip 2>/dev/null || true
fi
apt-get install -y git curl wget unzip cron

# Đảm bảo dịch vụ cron được kích hoạt và chạy nền
if command -v systemctl &>/dev/null; then
    systemctl enable cron 2>/dev/null || true
    systemctl start cron 2>/dev/null || true
else
    service cron start 2>/dev/null || true
fi

echo -e "${YELLOW}3. Cài đặt Node.js & NPM (Phiên bản LTS)...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo -e "${GREEN}Node.js đã được cài đặt: $(node -v)${NC}"
fi

echo -e "${YELLOW}4. Đang cài đặt mã nguồn VPS Manager...${NC}"
# Tạo thư mục và tải code từ Git
GIT_REPO="https://github.com/Phat-471/vps-manager.git"

echo -e "Nhập link Git chứa code của bạn (Bấm Enter để dùng mặc định: $GIT_REPO):"
if [ -t 0 ]; then
    read -r INPUT_REPO
elif [ -c /dev/tty ]; then
    read -r INPUT_REPO </dev/tty
else
    INPUT_REPO=""
fi
if [ -n "$INPUT_REPO" ]; then
    GIT_REPO="$INPUT_REPO"
fi

rm -rf /var/www/vps-manager
echo -e "Đang tải mã nguồn từ: ${BLUE}$GIT_REPO${NC}..."
git clone "$GIT_REPO" /var/www/vps-manager

if [ ! -d /var/www/vps-manager ]; then
    echo -e "${RED}Lỗi: Không thể tải mã nguồn từ Git.${NC}"
    report_status "failed" "Không thể clone mã nguồn từ Git" "" "" "$OS_VERSION"
    exit 1
fi

cd /var/www/vps-manager || exit

echo -e "${YELLOW}5. Đang cài đặt thư viện Backend (Chỉ các thư viện chạy trực tiếp)...${NC}"
npm install --omit=dev

echo -e "${YELLOW}6. Giao diện Frontend đã được biên dịch sẵn trong thư mục public/...${NC}"

echo -e "${YELLOW}7. Thiết lập cấu hình mạng & mật khẩu bảo vệ Panel...${NC}"
# Tìm một port ngẫu nhiên chưa sử dụng từ 10000 - 65000
echo -e "Đang quét cổng (port) trống trên hệ thống..."
while true; do
    RANDOM_PORT=$((10000 + RANDOM % 55000))
    if ! ss -tuln 2>/dev/null | grep -q ":$RANDOM_PORT " && ! netstat -tuln 2>/dev/null | grep -q ":$RANDOM_PORT " && ! lsof -i :$RANDOM_PORT &>/dev/null; then
        break
    fi
done

echo -e "Chúng tôi đề xuất chạy Panel trên cổng ngẫu nhiên bảo mật: ${GREEN}$RANDOM_PORT${NC}"
echo -e "Nhập cổng bạn muốn sử dụng (Bấm Enter để dùng cổng đề xuất: $RANDOM_PORT):"
if [ -t 0 ]; then
    read -r INPUT_PORT
elif [ -c /dev/tty ]; then
    read -r INPUT_PORT </dev/tty
else
    INPUT_PORT=""
fi
if [ -n "$INPUT_PORT" ] && [[ "$INPUT_PORT" =~ ^[0-9]+$ ]]; then
    PORT="$INPUT_PORT"
else
    PORT="$RANDOM_PORT"
fi

echo -e "Nhập mật khẩu Panel bạn muốn đặt (Tối thiểu 6 ký tự, nhập ẩn, bấm Enter để tự động tạo):"
if [ -t 0 ]; then
    read -r -s PANEL_PW
elif [ -c /dev/tty ]; then
    read -r -s PANEL_PW </dev/tty
else
    PANEL_PW=""
fi
if [ -z "$PANEL_PW" ]; then
    # Tạo mật khẩu ngẫu nhiên 12 ký tự an toàn
    PANEL_PW=$(head /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 12)
    echo -e "${GREEN}Mật khẩu ngẫu nhiên được tạo tự động: $PANEL_PW${NC}"
else
    while [ ${#PANEL_PW} -lt 6 ]; do
        echo -e "${RED}Mật khẩu quá ngắn, vui lòng nhập lại (Tối thiểu 6 ký tự):${NC}"
        if [ -t 0 ]; then
            read -r -s PANEL_PW
        elif [ -c /dev/tty ]; then
            read -r -s PANEL_PW </dev/tty
        else
            break
        fi
    done
fi

# Ghi cấu hình vào .env
echo "PANEL_PASSWORD=$PANEL_PW" > /var/www/vps-manager/.env
echo "PORT=$PORT" >> /var/www/vps-manager/.env
echo -e "${GREEN}Đã cấu hình cổng $PORT và mật khẩu Panel thành công!${NC}"

echo -e "${YELLOW}8. Cài đặt PM2 và thiết lập chạy nền (Tối ưu RAM tối đa)...${NC}"
npm install -g pm2
pm2 delete vps-manager 2>/dev/null || true
pm2 start server/server.js --name "vps-manager" --node-args="--max-old-space-size=128 --optimize_for_size --gc_interval=100"
pm2 save

# Cấu hình tự khởi động PM2 khi reboot VPS
pm2 startup | tail -n 1 | bash

echo -e "${YELLOW}9. Mở cổng $PORT trên Tường lửa UFW...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow "$PORT"/tcp
    ufw reload
fi

# Cài đặt mã nguồn giám sát (vnstat hoặc sử dụng lệnh bash gửi định kỳ)
echo -e "${YELLOW}10. Cấu hình dịch vụ Giám sát tài nguyên & Băng thông trung tâm...${NC}"
cat << 'EOF' > /usr/local/bin/vps-monitor.sh
#!/bin/bash
IP_VPS=$(curl -s https://api.ipify.org || curl -s https://ifconfig.me)
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
RAM_TOTAL=$(free -m | awk '/Mem:/ {print $2}')
RAM_USED=$(free -m | awk '/Mem:/ {print $3}')
RAM_PERCENT=$(awk "BEGIN {print ($RAM_USED/$RAM_TOTAL)*100}")
DISK_PERCENT=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')

# Đọc thống kê truyền tải mạng qua interface mặc định (tìm thông minh card mạng kết nối Internet)
INTERFACE=$(ip route show | grep default | awk '{for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}' | head -n1)
if [ -z "$INTERFACE" ]; then
    INTERFACE=$(ip link show | awk -F': ' '/state UP/ {print $2}' | head -n1)
fi
if [ -z "$INTERFACE" ]; then
    INTERFACE="eth0"
fi

RX_BYTES=$(cat /sys/class/net/$INTERFACE/statistics/rx_bytes 2>/dev/null || echo 0)
TX_BYTES=$(cat /sys/class/net/$INTERFACE/statistics/tx_bytes 2>/dev/null || echo 0)

PANEL_URL="PANEL_URL_PLACEHOLDER"
TOKEN="SECURITY_TOKEN_PLACEHOLDER"

if [ -n "$PANEL_URL" ] && [ "$PANEL_URL" != "PANEL_URL_""PLACEHOLDER" ]; then
    curl -k -s -X POST "$PANEL_URL/monitor.php" \
         -H "Content-Type: application/json" \
         -H "X-Secure-Token: $TOKEN" \
         -d "{\"ip\":\"$IP_VPS\",\"cpu\":$CPU_USAGE,\"ram\":$RAM_PERCENT,\"disk\":$DISK_PERCENT,\"rx\":$RX_BYTES,\"tx\":$TX_BYTES}" >/dev/null 2>&1
fi
EOF

# Thay thế URL callback và Token trong script giám sát
sed -i "s|PANEL_URL_PLACEHOLDER|${PANEL_URL}|g" /usr/local/bin/vps-monitor.sh
sed -i "s|SECURITY_TOKEN_PLACEHOLDER|${TOKEN}|g" /usr/local/bin/vps-monitor.sh
chmod +x /usr/local/bin/vps-monitor.sh

# Cài đặt cron job chạy 5 phút một lần
(crontab -l 2>/dev/null | grep -v "vps-monitor.sh"; echo "*/5 * * * * /usr/local/bin/vps-monitor.sh") | crontab -

# Thực thi lần đầu tiên để đẩy stats lên ngay
/usr/local/bin/vps-monitor.sh >/dev/null 2>&1 || true

# Báo cáo cài đặt thành công về máy chủ trung tâm
report_status "success" "Cài đặt VPS Manager Panel hoàn tất thành công!" "$PORT" "$PANEL_PW" "$OS_VERSION"

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
echo -e "2. Đảm bảo mở cổng ${GREEN}${PORT}${NC} trong cấu hình Firewall của nhà cung cấp VPS."
echo -e "Hướng dẫn sử dụng Native Mode (Quản lý trực tiếp không qua SSH):"
echo -e "👉 Trên giao diện Web Panel, chọn ${GREEN}Thêm VPS${NC}."
echo -e "👉 Nhập IP: ${GREEN}127.0.0.1${NC} (hoặc ${GREEN}localhost${NC})."
echo -e "👉 Các ô tài khoản SSH, cổng 22, mật khẩu bạn có thể nhập thông tin bất kỳ để lưu lại."
echo -e "👉 Hệ thống sẽ tự nhận diện IP cục bộ và chạy lệnh trực tiếp bằng Native Engine."
echo -e "Lưu ý: Mở cổng $PORT trên cấu hình Firewall nhà cung cấp VPS nếu có (như AWS, Google Cloud)."
echo -e "${BLUE}==================================================${NC}"
