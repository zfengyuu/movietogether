# VIMO CINÉ V5 · Rạp xem chung 3D

**Source:** React, Three.js/React Three Fiber, Drei, Socket.IO, Express, YouTube IFrame API.

## Các thay đổi V5
- **Màn chiếu:** một iframe YouTube duy nhất gắn vào `<Html transform>` của Drei tại vị trí rạp; xoay OrbitControls thì video bám góc máy. Không còn nút "Xem lớn" hay iframe 2D cố định.
- **Sân khấu:** tối đa **4** avatar thật cùng nhảy; server cấp vị trí độc quyền và giải phóng khi rời sân khấu/rời phòng. 4 vòng LED và lối đi sáng hai bên; người sẽ di chuyển theo các waypoint.
- **Avatar:** trang phục và tóc đẹp hơn, mắt/miệng/giày, tên xuất hiện phía trên. Ngồi hướng về màn hình.
- **Chat:** gõ và Enter gửi; tin nhắn hiện trong phòng, có bộ emoji, bong bóng chat trên đầu avatar.
- **Gửi nhạc:** modal ngắn để dán YouTube và ghi tiêu đề; không điền video test. File nhạc riêng trong phần mở rộng.
- **Hàng chờ:** server xếp theo vote giảm dần, hòa vote theo thời điểm thêm; mỗi người được tối đa 3 bài đang chờ. Vote một lần theo định danh tài khoản hoặc socket. Có vote skip.
- **Tủ đồ:** skin Mint 10.000 xu, Peach 20.000 xu, Midnight 30.000 xu, Royal 50.000 xu; trừ xu tại server, skin mua sẽ nằm trong ví demo.
- **Chiếu ảnh:** giữ khả năng gửi ảnh + tin nhắn; chi phí tính trên server.
- **Voice:** đã gỡ giao diện, endpoint và thư viện LiveKit khỏi dependencies.
- **VietQR:** tài khoản đăng nhập có thể tạo mã QR chuyển khoản (khi chủ rạp cấu hình ngân hàng); trạng thái **pending**. **KHÔNG cộng tiền thật** khi chưa có webhook xác minh ngân hàng, kho dữ liệu giao dịch bền vững và đối soát. QR không chứng minh người gửi đã chuyển khoản.

## Cài đặt
Cần Node.js 22. `npm install && npm run dev`. Mở http://localhost:5173.
`npm test` để thử quy tắc sân khấu/vote/YouTube/QR.
`npm run build` để build frontend.
`npm run smoke` chạy kiểm tra 2 người khi backend đang chạy.

## VietQR
Sao chép `.env.example` thành `.env` và cung cấp các biến `VIMO_BANK_ID`, `VIMO_BANK_ACCOUNT`, `VIMO_BANK_NAME` nếu muốn tạo QR hướng dẫn chuyển khoản.
Tài khoản ngân hàng phải là tài khoản chính chủ và đối chiếu với thông tin thật trong ứng dụng ngân hàng.
**V5 KHÔNG có tính năng nạp ví tiền thật tự động.** Để bật, cần kết nối cổng giao dịch xác thực, webhook có kiểm tra chữ ký, kiểm tra đúng số tiền/mã tham chiếu, lưu ledger PostgreSQL transaction và chống xử lý trùng. Không bật số dư xu thành tiền thật.

## Lưu ý triển khai
Hệ thống vẫn là demo Node một tiến trình: phòng, hàng chờ và ví tạm lưu trong RAM; tài khoản demo ở JSON. Chưa load-test 100 người. YouTube có thể từ chối nhúng hoặc autoplay.
