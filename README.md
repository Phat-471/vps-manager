# VPS Manager Ultimate 🚀

**VPS Manager Ultimate** là một bảng điều khiển (Control Panel) quản trị VPS từ xa gọn nhẹ, hiện đại và bảo mật. Được thiết kế với giao diện kính mờ (Glassmorphism UI) sang trọng, hệ thống giúp người mới bắt đầu quản lý VPS Linux (Ubuntu/Debian) một cách dễ dàng nhất thông qua giao diện Web trực quan thay vì dòng lệnh SSH phức tạp.

---

## ✨ Tính năng nổi bật

1. **Lớp Bảo mật Đăng nhập (Authentication Layer)**:
   * Bảo vệ bảng điều khiển bằng mã khóa token chữ ký số HMAC-SHA256 bảo mật.
   * Chế độ tự động khóa phiên làm việc sau 7 ngày hoặc khi bấm Đăng xuất.
   * Cấu hình dễ dàng thông qua biến môi trường `PANEL_PASSWORD` tại file `.env`.
2. **Bộ cài đặt 1-Click nhanh Web/App**:
   * **WordPress**: Tự động tải code, cấu hình database, tạo Nginx ảo hóa, tự động cài đặt qua WP-CLI (đăng nhập trực tiếp vào `/wp-admin` ngay sau khi cài).
   * **phpMyAdmin**: Quản lý CSDL MySQL trực quan chạy độc lập qua Nginx ở cổng 8888.
   * **Portainer CE**: Trình quản trị Container Docker trực quan ở cổng 9000/9443.
   * **Node.js Git Deploy**: Tải mã nguồn từ Git repo bất kỳ, cài đặt dependency và chạy nền thông qua PM2 hoàn toàn tự động.
3. **Quản lý Web Server Nginx chuyên nghiệp**:
   * Thêm/Xóa/Bật/Tắt các Website ảo (Virtual Hosts).
   * Chỉnh sửa cấu hình file config Nginx trực tiếp bằng Editor kính mờ.
   * Cài đặt chứng chỉ SSL miễn phí (Let's Encrypt) tự động bằng 1 click.
4. **Quản lý MySQL tối ưu**:
   * Quản lý Cơ sở dữ liệu (Database) và Người dùng (MySQL Users).
   * Xuất bản sao lưu (Backup/Export SQL) và Nhập dữ liệu (Import SQL).
   * Tự động lọc ẩn các tài khoản hệ thống của MySQL để tránh xóa nhầm, đi kèm tính năng Sửa lỗi Hệ thống tự động.
5. **Trình quản lý File (FileManager)**:
   * Thiết kế 3 cột trực quan (Cột Lối tắt nhanh, Cột Quản lý file chính, Cột Xem chi tiết & Xem thử).
   * Xem thử nội dung tệp tin văn bản trực tiếp.
   * Hỗ trợ Chmod, Copy, Rename, Download, Delete, và Soạn thảo mã nguồn.
   * Kéo & Thả file (Drag and Drop) trực tiếp từ máy tính vào trình duyệt để tải lên.
6. **Công cụ hệ thống & Giám sát**:
   * Biểu đồ giám sát thời gian thực (Real-time CPU, RAM, Disk, Uptime) qua kết nối WebSocket.
   * Dọn dẹp logs hệ thống, giải phóng bộ nhớ đệm RAM Cache và Khởi động lại VPS an toàn.
   * Hỗ trợ đổi mật khẩu tài khoản SSH trực tiếp.

---

## 🖥️ Giao diện Glassmorphism cao cấp

Hệ thống được thiết kế với ngôn ngữ thiết kế kính mờ hiện đại:
* Bảng điều khiển màu tối (Deep Space Blue `#070913`).
* Hiệu ứng hào quang chuyển động mượt mà.
* Các khối hộp kính mờ phản chiếu ánh sáng sắc nét.

---

## ⚡ Hướng dẫn Cài đặt trên VPS (1-Click Install)

Chỉ cần một dòng lệnh duy nhất để tự động cài đặt Node.js, PM2, Git, tải mã nguồn, cấu hình Tường lửa, thiết lập mật khẩu bảo mật và khởi chạy Panel chạy nền vĩnh viễn trên VPS của bạn.

### Cách chạy cài đặt:

1. Đăng nhập vào VPS của bạn qua SSH dưới quyền `root`.
2. Chạy lệnh cài đặt sau:
   ```bash
   curl -sSL https://raw.githubusercontent.com/<TÊN_TÀI_KHOẢN_GIT_CỦA_BẠN>/vps-manager/main/install.sh | sudo bash
   ```
   *(Thay thế `<TÊN_TÀI_KHOẢN_GIT_CỦA_BẠN>` bằng username GitHub của bạn sau khi fork hoặc push code lên Git).*

### Các bước script thực hiện tự động:
1. Cập nhật hệ thống và cài đặt các công cụ cơ bản (`git`, `curl`, `wget`).
2. Tự động cài đặt **Node.js LTS (v20)**.
3. Clone mã nguồn từ kho Git về thư mục `/var/www/vps-manager`.
4. Cài đặt các thư viện Backend & Frontend.
5. **Hỏi và thiết lập mật khẩu bảo mật** để đăng nhập từ xa.
6. Cài đặt **PM2**, cấu hình chạy nền và tự động khởi động Panel cùng hệ thống.
7. Mở cổng **3000** trên tường lửa UFW của VPS.
8. Trả về địa chỉ truy cập từ xa: `http://<IP_CỦA_VPS>:3000`.

---

## 🔒 Hướng dẫn cấu hình Thủ công

Nếu bạn không sử dụng script cài đặt tự động, bạn có thể thiết lập thủ công:

1. **Khởi tạo file cấu hình `.env`**:
   Tạo tệp tin `.env` tại thư mục gốc của dự án:
   ```env
   PORT=3000
   PANEL_PASSWORD=your_secure_password_here
   ```
   *(Nếu không thiết lập `PANEL_PASSWORD`, Panel sẽ mở ở chế độ không mật khẩu).*

2. **Cài đặt thư viện**:
   ```bash
   # Cài đặt backend
   npm install
   
   # Cài đặt frontend
   cd frontend
   npm install
   ```

3. **Biên dịch Frontend**:
   ```bash
   npm run build
   ```

4. **Khởi động Server**:
   ```bash
   cd ..
   # Chạy chế độ sản xuất (Production)
   npm start
   
   # Chạy chế độ phát triển (Development với Nodemon)
   npm run dev
   ```

---

## 🛠️ Yêu cầu Hệ thống
* **Hệ điều hành**: Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS hoặc Debian 11 / 12.
* **Node.js**: Phiên bản >= 18.0.0.
* **Cấu hình tối thiểu**: 1 vCPU, 1 GB RAM.

---

## 📄 Giấy phép
Dự án được phân phối dưới giấy phép MIT License. Tự do sử dụng, chỉnh sửa và đóng góp phát triển.
