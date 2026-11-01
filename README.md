# HộiRoom — Multiroom realtime 3D (Cinema / DJ / Music Box)

**Branch preview, not production.** Cinema, DJ Club and Music Box share rooms, avatars, chat, media queue and account wallet. No real VietQR payment is activated.

## V6 features

- Create Cinema (2–100 people), DJ Club (2–100), Music Box (2–20). Configure room visibility, capacity, optional password; share invitation token for private rooms. Private rooms are excluded from public search. When the final attendee leaves, demo rooms disappear (RAM-backed).
- DJ Club adds a raised DJ console and neon light display, and supports SoundCloud via official widget along with YouTube. Unembeddable tracks might fail. No audio proxy, downloader or circumvention.
- Music Box has a microphone and lounge preview, karaoke turn queue (join, withdraw, host next) and mic control. LiveKit server-side token plus active participant permission update restrict audio publishing to the current singer. Users must rejoin voice when receiving the turn if previously subscribed only. **Requires LiveKit service + env vars**. Use headphones to reduce feedback. Embedded YouTube karaoke content must be licensed/allow embedding; there is no automatically extracted lyrics.
- Paid photo insertion: 1.000 demo credits per second; server pauses the original media clock for the entire paid image queue and resumes it only afterwards. Insufficient credit keeps staged photo in RAM pending a signed sandbox payment if connected to PostgreSQL. **Never transfer real money to a test QR.**
- PostgreSQL transactional wallet ledger, signed SePay sandbox webhook, idempotent transactions and login-linked wallets; test/demo authentication remains JSON on a single server and sessions in RAM.

## Run

Node 22. `npm install`, then `npm run dev`, visit http://localhost:5173. Run `npm test`. Set `DATABASE_URL` and run `npm run db:migrate` to enable transactional sandbox wallet. LiveKit env vars: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Full instructions and safety guidance below.

## Deployment blockers

1. Harden auth with persistent sessions, CSRF protection, rate limiting, user identity recovery and moderator controls.
2. Use object storage for images, scan/moderate content, enforce copyright, and keep a persistent room/queue state.
3. Verify payment-provider contracts/webhook shape in live integration, reconcile bank statements, prevent under/overpaid orders, and build refund/dispute procedures before allowing VND.
4. Load-test concurrent rooms and voice participants, secure uploaded media and configure multi-instance Socket.IO adapter.
5. Deploy HTTPS with a durable PostgreSQL database and LiveKit service.

---

## Ưu tiên chiếu ảnh: 1.000đ / giây — cơ chế demo (2026-11-01)

- Mức giá đề xuất: **1.000 VND cho mỗi giây** (1–60 giây). Ví dụ 5 giây = 5.000đ, 10 giây = 10.000đ, 30 giây = 30.000đ. Máy chủ tự tính tiền và trừ xu demo, không tin số tiền gửi từ client.
- Khi ảnh bắt đầu chiếu, **phát video/nhạc đang chạy được tạm dừng đúng vị trí** trên toàn phòng. Hết thời gian ảnh, nếu còn ảnh đang chờ thì chiếu tiếp; **chỉ sau khi hết tất cả ảnh mới trả lại video và trạng thái play/pause cũ**.
- Trong lượt ảnh, từ chối thao tác đổi/tua/chuyển bài và bỏ phiếu skip để bảo toàn trạng thái. Hiển thị cho người mới vào phòng cũng nhận trạng thái tạm dừng và ảnh hiện tại.
- **Chưa có thanh toán VND thật.** 200.000 xu demo là tiền ảo để kiểm thử. Trong production phải tích hợp cổng thanh toán, webhook ký số / xác thực phía server, idempotency, hồ sơ giao dịch, quyền yêu cầu hoàn tiền, kiểm duyệt ảnh và lưu dữ liệu bền vững trước khi chấp nhận nạp tiền thật.

---

# HỘIROOM — Rạp 3D xem chung và nghe nhạc cùng bạn bè

**Cập nhật màn hình YouTube bám đúng mặt phẳng 3D.** Bản này chuyển iframe từ khung 2D phủ màn hình sang `@react-three/drei` `<Html transform center distanceFactor={0.96}>` ở đúng tọa độ màn chiếu, để phối cảnh của iframe thay đổi theo camera. Ảnh ưu tiên cũng hiển thị theo cùng mặt phẳng 3D.

- Trong rạp: YouTube chính thức với `controls=0`; nút điều khiển phát nhạc nằm trong UI rạp, không chặn kéo xoay camera.
- Nút **Xem lớn** hoặc fullscreen trên thanh trên cùng: dùng Fullscreen API cho **chính iframe đang phát**, không tạo player thứ hai.
- Nếu trình duyệt từ chối fullscreen, thông báo lỗi thay vì để video nổi cố định sai vị trí.
- YouTube có thể hiện thương hiệu/quảng cáo và từ chối nhúng một số video. Không dùng canvas capture, proxy hay giải mã YouTube trái điều khoản.

**Kiểm tra:** chọn góc *3D*, kéo xoay camera sang hai bên; iframe phải thu/phóng/nghiêng theo viền màn hình. Nhấn *Xem lớn*, thoát bằng Esc, sau đó tiếp tục xoay camera. Kiểm tra trên desktop và điện thoại. 

---

# HỘIROOM V4 — sân khấu LED, YouTube gọn, tài khoản, chiếu ảnh ưu tiên

# 🎬 HỘIROOM — bản nâng cấp sân khấu & phát nhạc

**Source code demo đầy đủ chức năng cốt lõi** cho website rạp phim / nghe nhạc chung 3D, lấy cảm hứng từ *bố cục tính năng* trong ảnh tham chiếu của người dùng. Đây là code viết mới, **không phải mã nguồn hoặc bản sao tài sản của choigivui.com**.

## 1. Công nghệ

| Lớp | Công nghệ |
|---|---|
| Frontend | React 19, Vite 6, CSS responsive, Lucide |
| 3D | Three.js, React Three Fiber 9, Drei 10 |
| Server | Node.js 20+/22, Express 5 |
| Realtime | Socket.IO 4 (rooms, broadcast, acknowledgements) |
| Media | YouTube IFrame API, HTML5 Audio/Video, HLS.js, VideoTexture |
| Voice (tùy chọn) | LiveKit Client + LiveKit Server SDK (WebRTC) |
| Demo audio | Web Audio API — âm thanh tổng hợp tự sinh, không dùng tác phẩm có bản quyền |
| Production mở rộng | Redis adapter, PostgreSQL + Prisma, CDN/streaming, load balancer |

## 2. Chạy trên máy

Cần **Node.js phiên bản 20.19+ hoặc 22.12+** và npm, trình duyệt có WebGL.

```bash
npm install
npm run dev
```

Mở **http://localhost:5173**. API/realtime ở `http://localhost:3001`.

Dùng 2 cửa sổ trình duyệt (hoặc máy/điện thoại khác trong cùng mạng đã cấu hình hostname) để thử multi-user.

- Điền tên → vào phòng **DISCO**.
- Bấm **Phát nhạc** nếu là chủ phòng, rồi **Bật âm thanh**.
- Thử **Nhảy dưới sàn**, **Lên sân khấu nhảy** (tối đa 12 người trên sân khấu), **Ngồi**, **Vẫy tay**, **Cổ vũ**, thay tóc/phụ kiện/quần áo và chọn ghế.
- Mở thêm cửa sổ, dùng mã **DISCO** để xem người còn lại đồng bộ.
- Bấm **Tạo phòng riêng**, mời bạn bè qua link và thử mật khẩu phòng.
- Tab **Gửi nhạc/video**: dán link YouTube (video/shorts/live), audio MP3/M4A/OGG/WAV/AAC/FLAC hoặc video MP4/WebM/HLS công khai. Chủ phòng có thể phát ngay, mọi người có thể xếp hàng chờ.
- Có thể tải file nhạc từ máy lên server demo (tối đa **20 MB/file**, lưu tạm tối đa **24 giờ**); file sau khi tải sẽ được thêm vào hàng chờ.
- Tab **Hàng chờ**: người thêm có thể xóa bài của mình; chủ phòng xóa, đẩy bài lên/xuống, tua/phát/dừng/chuyển bài; người xem bỏ phiếu skip.
- Tab **Ủng hộ**: gửi 4 loại **quà ảo miễn phí**, hiện popup và bảng quà trong phòng. **Không có thanh toán/nhận tiền thật**.
- Tab **Tủ đồ**: chọn 6 màu áo, 4 kiểu tóc, 4 phụ kiện, 5 màu quần; tất cả thấy thay đổi realtime.
- Góc máy **3D, nhìn màn hình từ phía trước, từ trên cao, từ sân khấu nhìn xuống khán giả**.
- Tab **Cài đặt**: 3 theme sân khấu Neon, Hoàng hôn, Ngân hà (chỉ chủ phòng). Các trang tự hạn chế nhúng/CORS có thể không chạy.
- **Chỉ chủ phòng** có quyền Phát / Dừng / Tua / Chuyển bài. Người khác có thể thêm hàng chờ, bỏ phiếu skip.

### Test API + Socket.IO

Terminal thứ nhất: `npm run dev:server`

Terminal thứ hai: `npm run smoke` (hoặc `node scripts/smoke-test.mjs`)

Bài test tạo 2 user, phòng riêng, quyền ghế, quyền host, chat, nhảy, hàng chờ và skip vote.

## 3. Bản production cùng một server

```bash
npm install
npm run build
SERVE_STATIC=true npm start
```

Mở **http://localhost:3001**. Đặt biến môi trường `PORT`, `FRONTEND_ORIGIN` phù hợp khi triển khai. Nếu frontend và API khác domain, cần cấu hình CORS và `VITE_SERVER_URL` (hoặc tự cấu hình `io('https://your-api')` trong `src/App.jsx`) cũng như proxy `/api` tương ứng.

**Không deploy backend Socket.IO lên serverless function thuần Vercel**: cần một Node process chạy liên tục để giữ kết nối realtime. Có thể đặt frontend ở Vercel/Cloudflare Pages, backend ở VPS/Render/Railway/Fly hoặc một Node host hỗ trợ WebSocket.

## 4. Bật voice chat LiveKit

Backend cần thiết lập biến môi trường (xem `.env.example`):

```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_key
LIVEKIT_API_SECRET=your_secret
```

Node process cần đọc những biến đó khi khởi chạy. Ví dụ trên macOS/Linux:

```bash
export LIVEKIT_URL='wss://your-project.livekit.cloud'
export LIVEKIT_API_KEY='...'
export LIVEKIT_API_SECRET='...'
npm run dev
```

**Không đưa API_SECRET vào frontend**. Server cấp token cho thành viên đã tham gia room. Mic chỉ hoạt động trên `localhost` hoặc HTTPS theo quy định của trình duyệt.

## 5. Các chức năng có sẵn

- Rạp 3D tự dựng bằng hình khối, 100 ghế/10 hàng, ghế không thể chọn trùng, màn hình lớn, bục nhảy nổi, bậc lên xuống, đèn LED, dàn đèn, laser, 4 góc camera.
- Avatar low-poly, tủ đồ 6 màu áo + 4 tóc + 4 phụ kiện + 5 màu quần, chuyển ghế, lên sân khấu hoặc nhảy dưới sàn, 3 điệu nhảy, ngồi, vẫy tay, cổ vũ, bóng chat cạnh nhân vật.
- Tạo phòng công khai/đặt mật khẩu, link mời `?room=ROOMID`, trần 100 socket/phòng.
- Chat realtime, emoji, danh sách thành viên và trạng thái online, host transfer khi host rời đi.
- Nhạc demo tự sinh có thể nghe mà không cần URL ngoài.
- Nhúng YouTube bằng **IFrame API chính thức** (không vẽ YouTube vào WebGL texture), video MP4/WebM/HLS qua video texture, nhạc MP3/M4A/WAV/OGG/AAC/FLAC qua phần tử audio HTML5; có upload nhạc lưu tạm.
- Đồng bộ phát/dừng/vị trí giữa nhiều người, tự sửa drift khi cần; đồng bộ nhờ trạng thái server.
- Hàng chờ nhạc/video 30 bài, thêm/xóa/sắp xếp, vote skip 35% với ít nhất 2 phiếu, chủ phòng có thể tua/phát/dừng/chuyển bài ngay. Có quà ảo trong phòng.
- Voice nhiều người nếu cấu hình LiveKit Cloud/self-hosted.
- CSS responsive cho máy tính và điện thoại (3D low-poly cần kiểm thử hiệu năng trên thiết bị thật).

## 6. Những giới hạn của **bản demo**

1. **Đây là source MVP, chưa phải sản phẩm production hoàn chỉnh và chưa chạy kiểm thử browser end-to-end trong môi trường tạo mã do npm registry không truy cập được.** Room và chat được giữ trong RAM của Node.js và sẽ mất khi server restart. Có tài khoản demo bằng file JSON và phiên đăng nhập RAM; chưa có hệ thống auth production, phân quyền quản trị bền vững hay giao diện xử lý báo cáo vi phạm.
2. Giới hạn **100 kết nối/phòng** được thực thi ở backend, nhưng **chưa benchmark sức tải** với 100 người thật và máy yếu. Cần giảm draw calls/InstancedMesh, LOD, assets GLB và test trước khi công bố chính thức.
3. 3 điệu nhảy là animation procedural (vẫy tay/lắc người/xoay), không phải motion-capture chuyên nghiệp; có thể nâng cấp GLB + Mixamo.
4. Nhạc demo là **âm tổng hợp nhịp đơn giản**, không phải playlist nhạc thương mại. Phim/nhạc từ bên ngoài có thể bị CORS, chính sách nhúng, bản quyền hoặc autoplay chặn.
5. Đồng bộ playback là **best-effort**, không đảm bảo frame-perfect hay loại bỏ được mọi độ trễ mạng. YouTube không được chuyển thành texture của Three.js vì giới hạn iframe/CORS.
6. Voice **chỉ hoạt động khi có LiveKit**; không có credentials thì nút trả về thông báo chưa cấu hình.
7. File nhạc upload lưu trong thư mục `uploads` của server demo, không quét nội dung độc hại ngoài kiểm tra chữ ký định dạng; không sử dụng làm hệ thống lưu trữ công khai. Có giới hạn file/kích thước/thời gian; cần object storage + auth + quét malware + kiểm soát bản quyền để vận hành thật.
8. **Ủng hộ chỉ là quà ảo miễn phí**. Chưa có cổng thanh toán, doanh thu hay tính năng chuyển tiền.
9. Để lên production: Postgres/Prisma, Redis Socket.IO adapter, auth/password hashing, rate limit, anti-spam, room TTL, moderation, HTTPS, backup, metrics, media CDN, quy định bản quyền, load test.

## 7. Cấu trúc dự án

```
vimo-cine/
  server/index.js                 # Express, Socket.IO, room state, token LiveKit
  src/App.jsx                    # UI rạp và tương tác, chat, media, voice
  src/components/Theatre.jsx     # Cảnh 3D, ghế, avatar, laser, màn hình
  src/components/useBeat.js      # Âm nhạc demo tổng hợp Web Audio
  src/components/AudioPlayer.jsx # Phát file nhạc đồng bộ HTML5 Audio
  uploads/                       # Kho tạm khi chạy server, không đóng gói
  src/styles.css                 # Giao diện desktop/mobile
  scripts/smoke-test.mjs         # Test 2 client realtime
  vite.config.js                 # Vite dev proxy tới API
  .env.example
  Dockerfile
  package.json
```

## 8. Lưu ý pháp lý

Chỉ dùng nội dung mà bạn có quyền chiếu/phát hoặc được nhà cung cấp cho phép nhúng; tuân thủ chính sách YouTube. Code không cung cấp khả năng truy cập/truyền phim thương mại trái phép.

---

*Dự án mẫu này được cung cấp để phát triển, thử nghiệm và nâng cấp — không tuyên bố đã kiểm thử trên tải production.*

---

## V3 — Midnight Neon UI và sửa YouTube fullscreen (01/11/2026)

**Các thay đổi của bản V3:**

1. UI đổi sang nền midnight navy, kính mờ tím/hồng/xanh điện theo mockup người dùng; player phía trái, toolbar bên phải, nút nhảy và chat ở dưới. Sân khấu 3D có đèn neon tím hồng và ghế tông xanh tím.
2. **Sửa trình phát YouTube**: trình nhúng IFrame API chính thức chạy ở một lớp HTML thật nằm trên màn hình sân khấu (vị trí được chiếu từ camera 3D), **không** gắn vào Drei `Html transform` để tránh việc iframe bị scale hoặc khó tương tác. `src/components/YouTubePlayer.jsx`.
3. Có **Xem YouTube lớn / Toàn màn hình** ở bảng đang phát, trong hàng chờ và trên thanh phía trên. Nút này yêu cầu browser Fullscreen API trực tiếp từ click; nếu bị chặn vẫn mở chế độ xem lớn phủ màn hình. Để trở lại rạp bấm **Về rạp** hoặc Escape.
4. Player có `allow="autoplay; encrypted-media; fullscreen..."`, `allowfullscreen`, `referrerpolicy="strict-origin-when-cross-origin"`, sự kiện `onReady`, `onAutoplayBlocked`, `onError`, `onStateChange`. Có nút **Bật video** bên ngoài iframe nếu trình duyệt chặn tự phát. Có link fallback **Mở YouTube** khi nội dung không cho nhúng.
5. **Hàng chờ mới**: thumbnail YouTube, thứ tự, tiêu đề, người gửi, phân loại, số vote riêng từng bài, thao tác bình chọn/bỏ chọn và tự sắp theo lượt vote. Chủ phòng vẫn có thể di chuyển hoặc xóa bài. Nút gửi video ngay tại cuối danh sách.
6. Camera mặc định thẳng hướng sân khấu, nhân vật ngồi quay đầu **về phía màn chiếu**; thay tông quần áo/avatar và ghế theo theme mới.
7. Hỗ trợ link YouTube watch, youtu.be, shorts, live và embed; có nút điền link demo IFrame API của YouTube để kiểm tra nhanh.

**Cách thử YouTube:**

```bash
npm install
npm run dev
```

- Truy cập `http://localhost:5173`, tham gia phòng `DISCO`.
- Mở **Gửi nhạc/video** → bấm **Điền video mẫu để thử YouTube** → **Phát ngay** nếu bạn là chủ phòng (người khác có thể **Thêm vào hàng chờ**).
- Nếu trình duyệt yêu cầu, bấm **Bật video** hoặc Play ngay trong player YouTube.
- Bấm **Xem YouTube lớn** để mở trình phát 16:9 ra toàn màn hình. Bấm **Về rạp** để quay lại cảnh 3D.
- Mở tab ẩn danh vào cùng phòng để thử phát/tạm dừng và đồng bộ. Video mới trong hàng chờ được chuyển bằng nút **Chuyển bài**, vote skip hoặc sau khi video kết thúc trên trình phát của chủ phòng.
- Test bộ phân tích link YouTube: `npm run test:youtube`; test nhiều socket: chạy server trước rồi `npm run smoke`.

**Giới hạn quan trọng:** YouTube không hỗ trợ vẽ luồng video vào `THREE.VideoTexture` theo cách làm trên, nên player được dựng bằng iframe HTML thật phủ đúng vị trí màn hình sân khấu ở góc camera chính diện. Khi xoay 3D nhiều, khung iframe là hình chữ nhật 2D xấp xỉ vị trí chiếu; dùng **Xem YouTube lớn** để xem chuẩn 16:9. Một số video của chủ sở hữu không cho nhúng sẽ chỉ xem được trên YouTube. Trình duyệt có thể chặn autoplay có tiếng cho tới khi người dùng bấm Play. Không tải lại luồng YouTube bằng công cụ bên thứ ba để né hạn chế bản quyền/nhúng.

**Trạng thái kiểm thử trong môi trường xuất source:** `node --check server/index.js` và 7/7 bài test URL đạt. Môi trường xuất source chưa tải được các thư viện npm, vì vậy **chưa kiểm chứng chạy giao diện thực tế hay xem YouTube end-to-end**. Cần chạy `npm install`, `npm run dev` và thử trên Chrome/Safari của bạn để xác nhận. Backend demo vẫn lưu phòng/hàng chờ trong RAM, không phải production.


## V4 — thay đổi mới

- **YouTube trên màn rạp:** `controls=0`, `fs=0`, `disablekb=1` theo YouTube IFrame API; dùng các nút Play/Pause/Seek/Skip của website thay vì thanh điều khiển gốc. Không cố che logo/quảng cáo/overlay bắt buộc của YouTube. Browser có thể chặn autoplay; bấm **Bật video** hoặc Play để phát. Một số video cấm nhúng.
- **Xem lớn:** Bấm **Xem YouTube lớn**; Web Fullscreen API có thể yêu cầu thao tác trực tiếp của người dùng.
- **Sân khấu mới:** 2 cặp loa trái/phải (4 tháp), mỗi tháp có 3 driver viền LED; dải LED bên tường, trần, disco ball, sàn LED 22 ô.
- **Đăng ký/đăng nhập:** Nhấn avatar góc phải; đặt username 3–24 chữ/số/_ và mật khẩu từ 8 ký tự. Backend dùng `crypto.scryptSync` và cookie `HttpOnly`/`SameSite=Lax`. Tài khoản lưu cục bộ `auth-data/accounts.json` trên 1 Node server; đăng nhập mất khi server khởi động lại. **Không dùng cấu hình demo này cho dịch vụ public có người dùng thật** mà chưa bổ sung database, session store, CSRF hardening, account recovery, HTTPS và rate limiting đầy đủ.
- **Ảnh ưu tiên từ ví:** Trong phòng chọn **Chiếu ảnh**, lấy tín dụng demo một lần (200.000 xu), gửi JPG/PNG/WebP/GIF <=12 MB, chọn 6–60 giây, chi phí 10.000 xu cho 6–9 giây hoặc 2.000 xu/giây từ 10 giây. Số dư được kiểm tra và trừ trên server, ảnh xếp hàng. Nhạc/video bên dưới tiếp tục. **Xu demo không phải tiền thật**, chưa tích hợp webhook ngân hàng/cổng thanh toán. File ảnh xóa định kỳ sau 24h; thử nghiệm không dành cho ảnh nhạy cảm.

### Giới hạn YouTube

Tham số `controls=0` ẩn thanh điều khiển YouTube theo tài liệu chính thức: https://developers.google.com/youtube/player_parameters . Nó KHÔNG bảo đảm loại bỏ logo, watermark, thông báo, quảng cáo hoặc giới hạn bản quyền. Tuyệt đối không che các thành phần bắt buộc của player. YouTube không cấp pixel texture cho Three.js qua API nhúng.

### Chạy

`npm install && npm run dev` rồi mở `http://localhost:5173`. Dùng Node 22. Thư mục `auth-data`, `uploads`, `photo-uploads` phải writable ở nơi chạy backend. Không đưa các thư mục đó vào git.
