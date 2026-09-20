# Smart.Dict — Hướng dẫn setup từ đầu tới lúc chạy

Một app từ điển Anh→Việt **offline-first** cho iPhone: từ có sẵn hiện tức thì (không mạng), từ lạ nhờ Gemini tra rồi tự lưu để lần sau offline. Không cần server, không cần domain, không tốn phí hosting.

---

## 0. Trong gói có gì

| File | Việc |
|---|---|
| `index.html`, `app.js`, `sw.js`, `manifest.json` | Bản thân cái app |
| `seed.json` | Từ điển offline (đang có 8 từ mẫu; sẽ thay bằng 5000 từ) |
| `icon-180/192/512.png` | Icon màn hình chính |
| `generate.html` | Máy sinh nghĩa cho 5000 từ bằng Gemini |
| `words-5000.txt` | Danh sách 5000 từ phổ biến nhất |
| `token-cost.xlsx` | Bảng tính token & chi phí |
| `README.md` | File này |

**Cần chuẩn bị:** 1 tài khoản GitHub (miễn phí) và 1 Gemini API key (miễn phí tại https://aistudio.google.com/apikey).

---

## 1. Đưa app lên mạng (GitHub Pages — free, có HTTPS)

> Bắt buộc phải chạy qua HTTPS thì tính năng offline mới hoạt động. GitHub Pages cho HTTPS sẵn.

1. Vào https://github.com → đăng nhập/đăng ký.
2. Bấm **New repository** → đặt tên (vd `dict`) → chọn **Public** → **Create repository**.
3. Trong repo: **Add file → Upload files** → kéo **toàn bộ file** trong gói vào (giải nén zip trước, upload các file rời — đừng để trong thư mục con) → **Commit changes**.
4. Vào **Settings → Pages**:
   - Source: **Deploy from a branch**
   - Branch: **main** · thư mục **/ (root)** → **Save**
5. Đợi ~1 phút, refresh trang Pages đó. Nó hiện link kiểu:
   `https://<tên-github>.github.io/dict/`
   → Đây là URL app của bạn. Mở thử trên máy tính xem có chạy không.

*(Cách nhanh khác, khỏi GitHub: vào https://app.netlify.com/drop, kéo thả cả thư mục vào → ra link HTTPS ngay.)*

---

## 2. Cài lên iPhone (tạo "shortcut" ngoài màn hình)

1. Mở URL ở trên bằng **Safari** (phải Safari, không phải Chrome).
2. Bấm nút **Share** (ô vuông + mũi tên lên) → kéo xuống chọn **Add to Home Screen** → **Add**.
3. Xong — icon "á" xanh xuất hiện ngoài màn hình chính. Bấm vào mở full màn hình như app thật.

> Lần đầu mở cần mạng ~2 giây để nạp app. Sau đó **tắt mạng vẫn dùng offline** với các từ đã có.

---

## 3. Gắn Gemini API key

1. Lấy key free: https://aistudio.google.com/apikey → **Create API key** → copy.
2. Mở app → tab **Cài đặt** → dán key vào ô **Gemini API key** → **Lưu cài đặt**.
3. Model để mặc định `gemini-2.5-flash-lite` (rẻ nhất). Xong — giờ gõ từ nào không có sẵn, AI sẽ tra và tự lưu.

> Key chỉ nằm trên máy bạn, không lên GitHub, không lộ cho ai.

**Tới đây app đã chạy được.** Phần dưới là để nạp sẵn 5000 từ cho offline mạnh hơn.

---

## 4. Sinh 5000 từ offline (tùy chọn nhưng nên làm)

1. Đảm bảo `generate.html` và `words-5000.txt` đã nằm trong repo (bước 1 đã upload rồi).
2. Trên **máy tính**, mở: `https://<tên-github>.github.io/dict/generate.html`
3. Key tự điền sẵn (dùng chung với app). Bấm **Bắt đầu sinh từ**.
4. Xem tiến trình: số thành công/lỗi, thời gian, **chi phí $ thật** (đọc token từ Gemini).
5. Sinh xong bấm:
   - **Tải seed.json** → file từ điển đầy đủ
   - **Tải usage.csv** → số token từng từ (để đổ vào file Excel bên dưới)

**Chạy nhiều đợt:** tick sẵn ô *"bỏ qua từ đã sinh"*. Tắt tab/mất mạng cứ mở lại bấm chạy tiếp, nó tự nối — không làm lại từ đầu.

**Free tier** giới hạn ~1000 request/ngày → có thể cần 2–3 ngày cho 5000 từ. **Trả phí** thì chạy 1 lèo, tốn khoảng **$1–2** (xem file Excel).

> Mẹo: chạy thử **50 từ** trước (đặt "Số từ lần này" = 50), tải seed.json ra đọc bằng mắt xem nghĩa có ổn không. Ổn rồi mới chạy full.

---

## 5. Đưa 5000 từ vào app trên iPhone

Generator chạy trên máy tính nên chưa nằm trong điện thoại. Làm 3 bước:

1. Trong repo: **Add file → Upload files** → kéo `seed.json` vừa tải vào, **commit đè** file cũ.
2. Mở `sw.js`, sửa dòng `const CACHE = 'smartdict-v1';` → đổi thành `'smartdict-v2'` → commit. *(Bước này bắt buộc, nếu không iPhone giữ bản cũ.)*
3. Trên iPhone: xoá icon app cũ → mở lại link bằng Safari → **Add to Home Screen**.

Giờ 5000 từ đã nằm sẵn trong máy, tra offline tức thì.

---

## 6. Bảng tính chi phí (token-cost.xlsx)

- Mở file, xem ngay **Chi phí ước tính** (mặc định ~$1.65 cho 5000 từ với Flash-Lite).
- Ô **vàng** chỉnh được: giá (B5/B6), số từ, token trung bình.
- Muốn số **thật**: mở `usage.csv` từ generator → copy 3 cột (word, input, output) → dán vào bảng từ ô **A19**. Tổng token và **Tổng chi phí thực tế** tự cập nhật.

---

## 7. Dùng hằng ngày

- **Tra từ:** gõ vào ô tìm kiếm, Enter. Nghĩa xếp theo mức phổ biến, có "feel" tiếng Việt.
- **Lưu ⭐:** bấm ngôi sao để lưu từ vào tab **Đã lưu** (nhóm theo ngày/tuần/tháng).
- **Ôn tập:** tab **Ôn tập** random 10 từ đã lưu, tự kiểm tra.
- **Offline:** từ đã tra một lần → tra lại được khi không mạng.

---

## 8. Cập nhật app sau này

Sửa file bất kỳ → upload đè lên GitHub → **luôn tăng số version trong `sw.js`** (`v2`→`v3`…) rồi mở lại app. Không tăng version thì iPhone giữ bản cache cũ.

---

## 9. Gặp lỗi thường gặp

| Triệu chứng | Cách xử lý |
|---|---|
| Gõ từ báo "API key sai" | Kiểm tra lại key trong Cài đặt; tạo key mới ở aistudio nếu cần |
| Từ lạ không tra được | Đang offline, hoặc chưa nhập key. Có mạng + có key mới nhờ AI được |
| Sửa app rồi mà iPhone không đổi | Chưa tăng version trong `sw.js`. Tăng lên rồi mở lại |
| Generator báo lỗi 429 liên tục | Đang bị giới hạn tốc độ. Giảm "Chạy song song" xuống 2, tăng "Giãn cách" lên 500ms |
| Chạy free tier tới lượt bị chặn | Hết hạn mức ngày. Mai chạy tiếp (tick "bỏ qua từ đã sinh") |
| iPhone tự xoá dữ liệu | Vào Cài đặt bấm "Xin iOS giữ dữ liệu"; và nhớ giữ app ngoài Home Screen |

---

## 10. Giá tham khảo (Gemini 2.5 Flash-Lite)

- **$0.10** / 1 triệu token input · **$0.40** / 1 triệu token output (rẻ nhất họ Gemini)
- 5000 từ ước tính **~$1.65** (≈ **$0.83** nếu dùng Batch API −50%)
- Tra lẻ hằng ngày: chưa tới nửa xu mỗi từ
- Có **free tier** (~1000 request/ngày) — đủ để build dần miễn phí

*Model có thể thay đổi/khai tử theo thời gian. Khi đó chỉ cần vào Cài đặt đổi tên model, không phải sửa code.*
