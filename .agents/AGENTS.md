# Project Rules for VPS Manager

## Quy trình Kiểm thử Bắt buộc trước khi Phát hành/Cập nhật (Testing Rules)

1. **Tự động kiểm thử trước khi đóng gói**: Trước khi cập nhật mã nguồn hoặc tạo tệp nén `vps-manager.zip` cho khách hàng, AI và lập trình viên phải thực hiện kiểm tra chức năng tại môi trường local hoặc môi trường test.
2. **Kiểm tra cú pháp & Build**:
   - Đối với Frontend: Phải chạy thử `npm run build` trong thư mục `frontend` để đảm bảo không bị lỗi biên dịch (build error).
   - Đối với Backend/Server: Đảm bảo không có lỗi cú pháp Javascript, chạy thử ứng dụng Node.js trước khi nén.
3. **Tính toàn vẹn của tệp cấu hình**:
   - Không được ghi đè hoặc làm mất tệp cấu hình `.env` của người dùng khi họ tiến hành cập nhật.
   - Các file script cài đặt và cập nhật (`.sh`) bắt buộc phải sử dụng định dạng xuống dòng của Linux (LF) thay vì Windows (CRLF).
4. **Xác nhận trạng thái**:
   - Chỉ upload và phát hành mã nguồn lên máy chủ trung tâm (`hoangphat.site`) sau khi tất cả các bước test trên đã vượt qua thành công.
