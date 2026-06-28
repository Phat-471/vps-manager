#!/bin/bash

# Mã màu hiển thị
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

GITHUB_REPO="https://github.com/Phat-471/vps-manager.git"
INSTALL_DIR="/var/www/vps-manager"

echo -e "${BLUE}=================================================="
echo -e "     VPS MANAGER PANEL - TRÌNH CÀI ĐẶT TỰ ĐỘNG    "
echo -e "==================================================${NC}"

# ── Kiểm tra bash ────────────────────────────────────────────
if [ -z "$BASH_VERSION" ]; then
  echo -e "${RED}Lỗi: Script phải chạy bằng bash.${NC}"
  echo -e "Hãy chạy lại: ${GREEN}curl -sSL https://raw.githubusercontent.com/Phat-471/vps-manager/main/web/install.sh | bash${NC}"
  exit 1
fi

# ── Kiểm tra quyền root ───────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Lỗi: Vui lòng chạy với quyền root (sudo bash).${NC}"
  exit 1
fi

# ── Lấy IP Public ─────────────────────────────────────────────
IP_VPS=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null \
      || curl -s --max-time 5 https://ifconfig.me 2>/dev/null \
      || echo "YOUR_VPS_IP")

# ── Tạo Swap nếu thiếu RAM ────────────────────────────────────
if [ -f /proc/meminfo ]; then
  TOTAL_SWAP=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
  if [ -z "$TOTAL_SWAP" ] || [ "$TOTAL_SWAP" -lt 1000 ]; then
    echo -e "${YELLOW}Cảnh báo: Chưa có đủ Swap (${TOTAL_SWAP}MB). Đang tạo Swap 1GB tự động...${NC}"
    swapoff /swapfile 2>/dev/null || true
    fallocate -l 1G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=1024 2>/dev/null
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile >/dev/null
    grep -q "/swapfile" /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo -e "${GREEN}Đã kích hoạt Swap 1GB thành công!${NC}"
  fi
fi

# ── Cập nhật hệ thống & cài công cụ cơ bản ───────────────────
echo -e "\n${YELLOW}[1/7] Cập nhật hệ thống và cài công cụ cần thiết...${NC}"
systemctl stop unattended-upgrades 2>/dev/null || true
killall apt apt-get dpkg 2>/dev/null || true
rm -f /var/lib/apt/lists/lock /var/cache/apt/archives/lock /var/lib/dpkg/lock*
dpkg --configure -a 2>/dev/null || true

if command -v chattr &>/dev/null; then
  chattr -R -i /usr/bin /usr/sbin /bin /sbin 2>/dev/null || true
fi

apt-get update -y -qq 2>/dev/null || true
apt-get install -y git curl wget unzip cron 2>/dev/null || {
  apt-get install -f -y 2>/dev/null || true
  apt-get install -y git curl wget unzip cron
}

# Đảm bảo cron chạy
systemctl enable cron 2>/dev/null || true
systemctl start cron 2>/dev/null || true

# ── Cài đặt Node.js LTS ──────────────────────────────────────
echo -e "\n${YELLOW}[2/7] Cài đặt Node.js LTS (nếu chưa có)...${NC}"
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
  apt-get install -y nodejs
else
  echo -e "${GREEN}Node.js đã có: $(node -v)${NC}"
fi

# ── Tải mã nguồn từ GitHub ───────────────────────────────────
echo -e "\n${YELLOW}[3/7] Tải mã nguồn VPS Manager từ GitHub...${NC}"

# Xử lý thư mục đã tồn tại
UPGRADE_MODE="n"
if [ -d "$INSTALL_DIR" ]; then
  echo -e "${YELLOW}Phát hiện cài đặt cũ tại $INSTALL_DIR.${NC}"
  echo -e "  ${GREEN}[1]${NC} Nâng cấp - Giữ nguyên cấu hình & dữ liệu"
  echo -e "  ${RED}[2]${NC} Cài sạch - Xóa toàn bộ và cài lại"
  echo -e "  [3] Hủy bỏ"
  echo -n "Lựa chọn (1-3, mặc định 1): "
  if [ -t 0 ]; then
    read -r UPDATE_CHOICE
  elif [ -c /dev/tty ]; then
    read -r UPDATE_CHOICE </dev/tty
  else
    UPDATE_CHOICE="1"
  fi

  case "$UPDATE_CHOICE" in
    2)
      echo -e "${RED}>> Cài sạch: Đang xóa dữ liệu cũ...${NC}"
      pm2 delete vps-manager 2>/dev/null || true
      pm2 save --force 2>/dev/null || true
      rm -rf "$INSTALL_DIR"
      ;;
    3)
      echo -e "${BLUE}Đã hủy.${NC}"
      exit 0
      ;;
    *)
      echo -e "${GREEN}>> Nâng cấp: Đang sao lưu cấu hình...${NC}"
      UPGRADE_MODE="y"
      mkdir -p /tmp/vps_manager_bak
      [ -f "$INSTALL_DIR/.env" ] && cp "$INSTALL_DIR/.env" /tmp/vps_manager_bak/.env
      [ -d "$INSTALL_DIR/uploads" ] && cp -rf "$INSTALL_DIR/uploads" /tmp/vps_manager_bak/uploads
      rm -rf "$INSTALL_DIR"
      ;;
  esac
fi

# Clone từ GitHub
echo -e "${BLUE}Đang clone mã nguồn từ GitHub...${NC}"
git clone --depth=1 "$GITHUB_REPO" "$INSTALL_DIR"

if [ ! -f "$INSTALL_DIR/package.json" ]; then
  echo -e "${RED}Lỗi: Không thể tải mã nguồn từ GitHub. Vui lòng kiểm tra kết nối mạng.${NC}"
  exit 1
fi
echo -e "${GREEN}Tải mã nguồn thành công!${NC}"

# Khôi phục cấu hình nếu nâng cấp
if [ "$UPGRADE_MODE" = "y" ]; then
  echo -e "${YELLOW}>> Đang khôi phục cấu hình và dữ liệu cũ...${NC}"
  [ -f /tmp/vps_manager_bak/.env ] && cp /tmp/vps_manager_bak/.env "$INSTALL_DIR/.env"
  [ -d /tmp/vps_manager_bak/uploads ] && cp -rf /tmp/vps_manager_bak/uploads/. "$INSTALL_DIR/uploads/" 2>/dev/null
  rm -rf /tmp/vps_manager_bak
  echo -e "${GREEN}Đã khôi phục cấu hình thành công!${NC}"
fi

cd "$INSTALL_DIR" || exit 1

# ── Cài đặt Dependencies ─────────────────────────────────────
echo -e "\n${YELLOW}[4/7] Cài đặt thư viện Backend...${NC}"
npm install --omit=dev

# ── Cấu hình Port & Mật khẩu ────────────────────────────────
echo -e "\n${YELLOW}[5/7] Cấu hình Panel...${NC}"

if [ "$UPGRADE_MODE" = "y" ] && [ -f "$INSTALL_DIR/.env" ]; then
  PORT=$(grep -E "^PORT=" "$INSTALL_DIR/.env" | cut -d'=' -f2)
  PANEL_PW=$(grep -E "^PANEL_PASSWORD=" "$INSTALL_DIR/.env" | cut -d'=' -f2)
  echo -e "${GREEN}Đã sử dụng lại cấu hình cũ: Port ${PORT}${NC}"
else
  # Tìm port trống ngẫu nhiên
  while true; do
    RANDOM_PORT=$((10000 + RANDOM % 55000))
    if ! ss -tuln 2>/dev/null | grep -q ":${RANDOM_PORT} "; then
      break
    fi
  done

  echo -e "Cổng đề xuất: ${GREEN}${RANDOM_PORT}${NC}"
  echo -n "Nhập cổng (Enter = dùng đề xuất): "
  if [ -t 0 ]; then
    read -r INPUT_PORT
  elif [ -c /dev/tty ]; then
    read -r INPUT_PORT </dev/tty
  else
    INPUT_PORT=""
  fi
  PORT=${INPUT_PORT:-$RANDOM_PORT}

  echo -n "Nhập mật khẩu Panel (Enter = tự động tạo): "
  if [ -t 0 ]; then
    read -r -s PANEL_PW
  elif [ -c /dev/tty ]; then
    read -r -s PANEL_PW </dev/tty
  else
    PANEL_PW=""
  fi
  echo ""

  if [ -z "$PANEL_PW" ]; then
    PANEL_PW=$(head /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 12)
    echo -e "${GREEN}Mật khẩu tự động: ${PANEL_PW}${NC}"
  fi

  echo "PANEL_PASSWORD=${PANEL_PW}" > "$INSTALL_DIR/.env"
  echo "PORT=${PORT}" >> "$INSTALL_DIR/.env"
fi

# ── Cài PM2 & Khởi động ─────────────────────────────────────
echo -e "\n${YELLOW}[6/7] Cài đặt PM2 và khởi động Panel...${NC}"
npm install -g pm2 2>/dev/null
pm2 delete vps-manager 2>/dev/null || true
pm2 start server/server.js --name "vps-manager" \
  --node-args="--max-old-space-size=128 --optimize_for_size"
pm2 save

STARTUP_CMD=$(pm2 startup 2>/dev/null | tail -n 1 | sed 's/^\$ //')
[ -n "$STARTUP_CMD" ] && eval "$STARTUP_CMD" 2>/dev/null || true

# ── Mở Firewall ──────────────────────────────────────────────
echo -e "\n${YELLOW}[7/7] Cấu hình Firewall...${NC}"
if command -v ufw &>/dev/null; then
  ufw allow "${PORT}/tcp" 2>/dev/null
  ufw reload 2>/dev/null || true
  echo -e "${GREEN}Đã mở cổng ${PORT} trên UFW.${NC}"
fi

# ── Kết quả cài đặt ──────────────────────────────────────────
echo -e "\n${BLUE}=================================================="
echo -e "${GREEN}        CÀI ĐẶT HOÀN TẤT THÀNH CÔNG!           ${NC}"
echo -e "${BLUE}==================================================${NC}"
echo -e ""
echo -e "  ${CYAN}Địa chỉ Panel:${NC}    ${GREEN}http://${IP_VPS}:${PORT}${NC}"
echo -e "  ${CYAN}Mật khẩu:${NC}         ${YELLOW}${PANEL_PW}${NC}"
echo -e "  ${CYAN}Đăng nhập nhanh:${NC}  ${GREEN}http://${IP_VPS}:${PORT}/?password=${PANEL_PW}${NC}"
echo -e ""
echo -e "${YELLOW}LƯU Ý:${NC}"
echo -e "  - Lưu lại mật khẩu ở trên."
echo -e "  - Mở cổng ${GREEN}${PORT}${NC} trong Firewall của nhà cung cấp VPS (AWS, GCP...)."
echo -e "  - Trong Panel: Thêm VPS với IP ${GREEN}127.0.0.1${NC} để dùng chế độ Native."
echo -e ""
echo -e "  ${CYAN}Cập nhật sau này:${NC} Chỉ cần bấm nút ${GREEN}'Cập nhật Panel'${NC} trong giao diện web."
echo -e "  (Không cần tạo Release thủ công trên GitHub nữa!)"
echo -e "${BLUE}==================================================${NC}"
