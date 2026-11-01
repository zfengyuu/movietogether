# HộiRoom — ví và chiếu ảnh ưu tiên (P0–P1)

Triển khai trong nhánh thử nghiệm. **Không nhận tiền thật** và chưa triển khai thanh toán production.

## Đã làm
- 1.000 xu thử/giây chiếu ảnh, từ 1 đến 60 giây; xác minh giá trên server.
- Nếu đủ tiền: trừ tiền và đưa ảnh lên màn hình. Nếu thiếu: giữ ảnh ngắn hạn, mở modal nạp; webhook SANDBOX có chữ ký SePay HMAC hợp lệ sẽ cộng ví, rồi thử chiếu ảnh chờ.
- Ví gắn account UUID khi cấu hình PostgreSQL. Ledger, order và ID giao dịch ngân hàng có unique constraint; transaction kèm hàng khóa để chống trừ tiền đồng thời.
- Ảnh đầu tạm dừng đồng hồ video tại thời điểm đó; ảnh cuối khôi phục trạng thái play/pause trước đó.
- Backend chặn load, seek, play, pause, next trong khi ảnh đang chiếu để không làm lệch trạng thái.

## Cài để thử
1. Node.js 20.19+ và PostgreSQL; npm ci để cài dependencies frontend.
2. Chạy **npm run db:setup** một lần để cài driver PostgreSQL (cập nhật package-lock.json), sau đó **npm run db:migrate**.
3. Cấu hình DATABASE_URL, PAYMENTS_MODE=sandbox, SEPAY_WEBHOOK_SECRET và VIETQR_BANK_ACCOUNT (chỉ tài khoản SANDBOX) trong .env.
4. Chạy npm run dev. Đăng ký tài khoản, vào phòng, mở Chiếu ảnh, chọn ảnh và thời lượng, rồi tạo yêu cầu nạp khi thiếu xu. Muốn thử webhook cần gửi payload đúng cấu trúc với HMAC hợp lệ từ môi trường thử.
5. Chạy npm test. Chưa xác nhận end-to-end với PostgreSQL thật hay SePay live; các test wallet-store hiện dùng fake DB và cần bổ sung test integration với PostgreSQL.

**Chưa sẵn sàng production:** auth tài khoản còn dạng demo lưu JSON, sessions nằm RAM, ảnh chờ trong RAM và file local; chưa có xử lý hoàn tiền khi server lỗi giữa thời điểm trừ tiền và hiển thị ảnh, chưa có đối soát ngân hàng, chưa có vận hành/backup, và chưa có đăng ký nhà cung cấp thanh toán. Mọi yêu cầu nạp thật phải tiếp tục bị chặn.
