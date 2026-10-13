# GrabCode — Kế hoạch xây dựng sản phẩm

Oct 12, 2026 · @haidm99

## Tóm tắt ý tưởng

GrabCode là sàn đặt POC theo yêu cầu: khách đặt đơn như gọi đồ ăn, một vibe coder nhận đơn, build trên IDE của bạn và giao link demo chạy thật trong 2–8 giờ. Mục đích duy nhất của sản phẩm là giúp bên bán có thứ để khách hàng bấm thử trước khi chốt deal.

Định vị một câu: *"Đặt POC như đặt đồ ăn — có demo trước bữa trưa."*

Nền tảng không can thiệp vào cách coder làm việc: họ dùng Claude Code hoặc công cụ AI quen tay của mình. GrabCode chỉ chuẩn hóa đầu vào (spec) và đầu ra (repo + link demo), nên lợi thế nằm ở dòng đơn đều, spec tốt, ký quỹ và kiểm định đầu ra, những thứ marketplace freelancer thông thường không có.

Mục tiêu 12 tháng đề xuất: 500 coder đã xác minh, 3.000 đơn/tháng, thời gian giao trung vị dưới 4 giờ, tỉ lệ nghiệm thu lần đầu trên 80%.

## Vấn đề, khách hàng và giá trị

Deal phần mềm thường chết ở khoảng trống giữa "khách thích ý tưởng" và "khách thấy nó chạy". Thuê agency làm POC mất 2–4 tuần và vài nghìn đô; đến lúc có demo thì khách đã nguội.

| Nhóm khách | Nỗi đau | Họ đặt gì | Sẵn sàng trả |
| --- | --- | --- | --- |
| Sales/presales ở công ty phần mềm, agency | Mất deal vì không có demo sát nhu cầu khách | Demo tùy biến theo use case của từng khách | Cao, tính vào chi phí bán hàng |
| Founder giai đoạn sớm | Cần prototype để gọi vốn hoặc thử thị trường | MVP clickable, landing page có chức năng | Trung bình |
| Product manager trong doanh nghiệp | Cần thuyết phục sếp duyệt ngân sách | POC nội bộ, dashboard, tool nhỏ | Trung bình–cao |
| Agency/outsourcing | Thiếu người làm pitch nhanh | Thuê ngoài phần demo khi đấu thầu | Cao, đơn lặp lại |

Với vibe coder, GrabCode cho họ dòng đơn đều, thanh toán nhanh trong ngày và không phải tự đi tìm khách. Giống tài xế Grab, họ chỉ cần bật app nhận đơn.

Giá trị cốt lõi gói trong ba lời hứa: **nhanh** (giờ, không phải tuần), **chạy thật** (link live, không phải mockup), **giá cố định** (biết giá trước khi đặt).

## Mô hình vận hành marketplace

GrabCode vận hành như Grab: nền tảng giữ khách, định giá, ghép đơn và bảo đảm chất lượng; coder là đối tác độc lập nhận đơn.

| Vai trò | Ứng với Grab | Việc chính |
| --- | --- | --- |
| Khách đặt đơn | Người gọi món | Mô tả POC, chọn gói, theo dõi tiến độ, nghiệm thu |
| Vibe coder | Tài xế | Bật trạng thái nhận đơn, build bằng công cụ riêng (Claude Code, Cursor…), giao repo + link |
| Nền tảng | Grab | Chuẩn hóa yêu cầu, báo giá, ghép coder, giữ tiền, chấm chất lượng, deploy |
| "Menu" template | Thực đơn nhà hàng | Bộ khung sẵn (CRM mini, dashboard, chatbot, app đặt lịch…) để rút ngắn thời gian build |

Điểm khác biệt quan trọng: đơn POC không đồng nhất như cuốc xe. Vì vậy cần một lớp **AI Brief** ở giữa, biến mô tả lộn xộn của khách thành spec chuẩn có phạm vi, tiêu chí nghiệm thu và mức độ khó. Chính spec này quyết định giá và ghép coder.

Phân hạng coder theo kiểu tài xế: Đồng → Bạc → Vàng → Kim cương, dựa trên tỉ lệ đúng giờ, điểm nghiệm thu và số đơn. Hạng cao nhận đơn khó, giá cao và được ưu tiên ghép.

## Luồng sản phẩm

Một đơn đi từ mô tả của khách đến link demo qua tám bước; tiền chỉ được giải ngân khi qua cả QA Gate tự động lẫn sự đồng ý của khách.

&#91;embedded content: luồng một đơn POC · 8 bước, 2 cổng kiểm\]

Đơn trượt QA Gate quay lại coder mà khách không thấy; đơn khách chưa ưng quay lại build trong giới hạn lượt sửa miễn phí, sau đó thành đơn bổ sung.

Chi tiết từng bước:

1. **Khách gửi yêu cầu**: mô tả ý tưởng, chọn gói, đính kèm tài liệu nếu có.
2. **Chuẩn hóa đơn**: AI Brief viết spec, chia công việc thành các mốc có trọng số %, đặt tiêu chí nghiệm thu và báo giá.
3. **Khách duyệt**: xác nhận spec, thanh toán ký quỹ; từ đây phạm vi bị khóa.
4. **Ghép coder**: hệ thống chọn coder theo hạng, kỹ năng và trạng thái online; coder bấm nhận đơn.
5. **Tạo repo tự động**: GitHub App của GrabCode tạo repo private cho đơn dưới organization của sàn (nền tảng là owner) và mời tài khoản GitHub của coder làm collaborator quyền write.
6. **Khởi tạo sẵn docs**: repo có sẵn README, CLAUDE.md (spec, tiêu chí, ràng buộc), docs/milestones.md (danh sách mốc và trọng số %), code template khởi đầu và workflow GitHub Actions để deploy preview.
7. **Build và cập nhật realtime**: coder commit gắn mã mốc (ví dụ `[M2]`) hoặc tick mốc trong milestones.md; webhook GitHub báo về sàn, tính % hoàn thành và đẩy realtime cho cả khách lẫn coder.
8. **Giao và đóng đơn**: QA Gate, link demo, khách nghiệm thu, giải ngân; sau đó gỡ quyền của coder khỏi repo; repo và sản phẩm vẫn thuộc nền tảng.

% tiến độ tính theo tổng trọng số các mốc đã xong và có CI xanh, không theo số commit, để tránh commit rác cho đẹp số.

## Tính năng MVP và roadmap

MVP chỉ cần đủ để một đơn chạy trọn vòng từ đặt đến giải ngân; mọi thứ khác để sau khi có 100 đơn/tháng.

| Tính năng MVP | Cho ai | Vì sao cần ngay |
| --- | --- | --- |
| Form đặt đơn + AI Brief | Khách | Biến mô tả mơ hồ thành spec, giá và tiêu chí nghiệm thu |
| Thanh toán ký quỹ | Khách, coder | Khách yên tâm trả trước, coder chắc chắn được trả |
| App coder: bật nhận đơn, nhận/từ chối | Coder | Trải nghiệm "tài xế" cốt lõi |
| Gói brief + repo khởi đầu | Coder | Spec xuất thành file CLAUDE.md kèm repo template, coder nạp thẳng vào Claude Code |
| Theo dõi tiến độ live | Khách | Như xem shipper trên bản đồ: các mốc, ETA, preview |
| Deploy từ repo ra link demo | Coder, khách | Sản phẩm giao là link chạy thật, không phải file zip |
| Chat trong đơn + nghiệm thu | Khách, coder | Giữ mọi trao đổi trên sàn, làm bằng chứng khi tranh chấp |
| Đánh giá hai chiều | Cả hai | Nền cho phân hạng coder về sau |

&#91;embedded content: roadmap 12 tháng · 4 giai đoạn, 3 cổng\]

Giai đoạn 0 cố ý làm thủ công để học khách thật sự đặt gì trước khi viết dòng code đầu tiên cho sàn.

## Kiến trúc kỹ thuật và cách coder kết nối

Coder viết code bằng công cụ riêng và nền tảng không chạm vào bước đó; GrabCode chỉ lo phần trước (spec, ghép, tiền) và phần sau (repo, kiểm, deploy, giải ngân).

&#91;embedded content: kiến trúc · 3 client, 6 dịch vụ, 1 lớp hạ tầng\]

Vì coder giữ nguyên công cụ của họ, điểm kết nối duy nhất là repo và một CLI nhỏ; thứ GrabCode giữ chặt là đầu vào và đầu ra:

- **Brief đóng gói**: repo của đơn có sẵn file CLAUDE.md chứa spec, tiêu chí nghiệm thu và ràng buộc, để Claude Code đọc ngay.
- **Repo theo đơn**: ngay khi ghép xong, GitHub App của GrabCode tạo repo private cho đơn (sàn là owner), mời tài khoản GitHub của coder làm collaborator và khởi tạo sẵn README, CLAUDE.md, milestones.md cùng workflow deploy; coder push như bình thường.
- **Mốc tiến độ**: lệnh `grabcode checkpoint` hoặc commit gắn mã mốc như \[M2\]; webhook GitHub báo về sàn, tính % theo trọng số mốc đã xong và CI xanh, đẩy realtime cho cả khách và coder.
- **Lệnh giao đơn**: `grabcode deliver` chạy QA Gate trên bản build, deploy vào sandbox và gửi link cho khách.
- **Chuyển giao**: repo luôn thuộc nền tảng; khách muốn nhận code để phát triển tiếp thì mua gói chuyển giao, khi đó sàn mới chuyển repo sang GitHub của khách kèm tài liệu ngắn.

IDE của bạn vẫn có thể tích hợp sẵn CLI này như một lựa chọn tiện hơn, nhưng không bao giờ là điều kiện để nhận đơn.

Stack đề xuất cho đội nhỏ: Next.js cho web khách, React Native hoặc Flutter cho app coder, Node.js hoặc Go cho backend, hàng đợi sự kiện cho luồng đơn, và container dùng một lần cho mỗi đơn để cách ly dữ liệu khách.

## Mô hình doanh thu và định giá

Doanh thu chính là phí hoa hồng 20–25% trên mỗi đơn, cộng thêm phí giao gấp và gói thuê bao cho khách đặt thường xuyên. Giá niêm yết cố định theo gói để khách không phải mặc cả.

| Gói | Thời gian giao | Phạm vi | Giá Việt Nam (VND) | Giá quốc tế (USD) | Coder nhận |
| --- | --- | --- | --- | --- | --- |
| Express | ≤ 3 giờ | 1 luồng chính, dùng template, data giả | 1,5–3 triệu | 99–199 | 75–80% |
| Standard | ≤ 8 giờ | 2–3 màn hình, 1 tích hợp API thật, auth cơ bản | 4–8 triệu | 299–599 | 75–80% |
| Pro | ≤ 24 giờ | Nhiều luồng, tích hợp dữ liệu khách, có hướng dẫn demo | 10–20 triệu | 800–1.500 | 75–80% |

Nguồn thu phụ:

- **Phí giao gấp**: +30–50% khi khách cần trong 1–2 giờ, giống phụ phí giờ cao điểm.
- **Thuê bao doanh nghiệp**: 1.500–5.000 USD/tháng cho số credit POC cố định, coder riêng và SLA.
- **Hosting demo**: miễn phí 14 ngày, sau đó tính phí giữ link chạy.
- **Chuyển thành sản phẩm**: khi deal chốt, GrabCode mở kết nối hai bên, hoặc làm trung gian cho giai đoạn triển khai với hoa hồng thấp hơn mức POC; khách muốn nhận repo thì trả thêm phí chuyển giao quyền sở hữu.
- **Template marketplace**: coder bán template, nền tảng chia doanh thu.

Kinh tế đơn vị cần đạt: giá trị đơn trung bình khoảng 400 USD, hoa hồng khoảng 90 USD, chi phí AI và hạ tầng mỗi đơn dưới 15 USD. Giai đoạn đầu tập trung thị trường Việt Nam nên cần bảng giá riêng bằng VND (cột VND ở bảng trên), thanh toán qua VNPay/MoMo; giá USD dành cho khách quốc tế khi mở rộng. Mức VND là đề xuất, cần kiểm chứng với 20 khách đầu.

## Chất lượng, bảo mật, IP và tranh chấp

Niềm tin là thứ quyết định sàn sống hay chết, nên chất lượng phải được kiểm tự động trước khi khách nhìn thấy sản phẩm.

**Cổng chất lượng tự động (QA Gate)** chạy trước khi giao:

1. Build và deploy thành công, link mở được trên desktop và mobile.
2. AI agent bấm thử từng tiêu chí nghiệm thu trong spec và chụp màn hình làm bằng chứng.
3. Quét bí mật lộ (API key, mật khẩu) và dependency có lỗ hổng đã biết.
4. Kiểm tra lịch sử commit trong repo của đơn để chặn việc nộp sản phẩm cũ lấy từ nơi khác.

**Bảo mật dữ liệu khách**: mặc định dùng dữ liệu giả; khi cần dữ liệu thật, khách tải lên vùng mã hóa chỉ coder của đơn đó truy cập, tự xóa sau khi đóng đơn. Coder ký NDA điện tử khi nhận đơn; gói doanh nghiệp được chọn coder đã xác minh danh tính (KYC).

**Sở hữu trí tuệ**: nền tảng là owner của repo và sản phẩm POC; coder chuyển toàn bộ quyền với code cho nền tảng khi nhận tiền. Khách được dùng bản demo để trình bày và bán hàng; muốn sở hữu code thì mua gói chuyển giao. Template nền tảng và template của coder được cấp phép sử dụng, không chuyển quyền sở hữu.

**Tranh chấp**: tiền giữ trong ký quỹ, giải ngân khi khách nghiệm thu hoặc tự động sau 24 giờ không phản hồi. Mỗi gói có 1–2 lượt sửa miễn phí trong phạm vi spec. Nếu tranh chấp, đối chiếu spec với bằng chứng QA Gate; hoàn tiền một phần hoặc toàn bộ theo bảng quy tắc công khai.

Điều khoản IP, NDA và thanh toán xuyên biên giới cần luật sư rà soát trước khi ra mắt; đây là khung đề xuất, không phải tư vấn pháp lý.

## Go-to-market và cung cầu ban đầu

Marketplace nào cũng gặp bài toán con gà – quả trứng; cách giải là khởi động phía cung trước bằng cộng đồng vibe coder sẵn có, rồi bán cho một ngách khách hàng hẹp.

**Phía cung (coder)**

- Mời 30–50 vibe coder giỏi từ cộng đồng Claude Code và AI builder làm "coder sáng lập", được giữ phí hoa hồng 10% trong 6 tháng đầu.
- Bài test đầu vào: build một POC mẫu trong 2 giờ, chấm bằng QA Gate.
- Cộng đồng Discord/Zalo, bảng xếp hạng tuần, thưởng cho coder giao nhanh nhất.

**Phía cầu (khách)**

- Bắt đầu với một ngách: presales của công ty SaaS và agency phần mềm, vì họ có ngân sách và đặt lặp lại.
- Founder-led sales: tự bán 20 khách đầu, làm POC miễn phí cho 5 deal để có case study "đặt lúc 9h, demo lúc 14h, chốt deal".
- Nội dung: video timelapse quá trình build POC, đăng LinkedIn, X, TikTok.
- Đối tác: cộng đồng startup, vườn ươm, chương trình accelerator tặng credit POC cho startup.

**Thị trường**: tập trung Việt Nam trước để vận hành rẻ và học nhanh, nhưng thiết kế song ngữ từ đầu vì khách trả cao nhất nằm ở Singapore, Nhật, Mỹ, Úc. Lợi thế chi phí coder Việt Nam là câu chuyện bán hàng mạnh.

## Giao dịch ngoài sàn và giai đoạn sau POC

GrabCode khóa chặt liên lạc trong giai đoạn POC, chỉ mở thông tin cho hai bên khi cả hai cùng accept, rồi để khách chọn làm trực tiếp hay giữ sàn làm trung gian cho giai đoạn triển khai.

| Nền tảng | Cách họ xử lý | Bài học cho GrabCode |
| --- | --- | --- |
| [Upwork](https://support.upwork.com/hc/en-us/articles/360043723533) | Buộc giữ công việc và thanh toán trên sàn 2 năm đầu; muốn ra ngoài phải trả phí chuyển đổi một lần bằng 13,5% thu nhập năm ước tính của freelancer; lách luật có thể bị khóa tài khoản vĩnh viễn | Có đường ra hợp lệ và có giá thì người dùng ít lách hơn |
| [Fiverr](https://platformchronicles.substack.com/p/platform-leakage) | Việc số, tiền chỉ trả khi khách hài lòng, nên cả hai bên tự muốn ở lại | Ký quỹ và kiểm định giữ người dùng tốt hơn cấm đoán |
| [Thumbtack](https://d3.harvard.edu/platform-digit/wp-json/wp/v2/hck-submission/6922) | Thu phí theo mỗi báo giá gửi khách thay vì theo giao dịch | Thu tiền ngay ở khâu kết nối, trước khi hai bên kịp đi riêng |
| [TaskRabbit](https://d3.harvard.edu/platform-digit/wp-json/wp/v2/hck-submission/6922) | 30% cho giao dịch đầu, 15% cho các lần sau | Hoa hồng giảm dần khi quan hệ đã thành |

Một thí nghiệm thực địa cho thấy khi liên lạc không bị nền tảng giám sát, tỉ lệ giao dịch ngoài sàn tăng tới 21,7 điểm phần trăm ([nghiên cứu](https://proceedings.emac-online.org/pdfs/A2023-114520.pdf)). Vì vậy giai đoạn POC cần giữ mọi trao đổi trên sàn.

**Mô hình đề xuất**

1. **Giai đoạn POC, khóa chặt**: chat chỉ trong đơn; tự che email, số điện thoại, link mạng xã hội trong chat và trong repo; hồ sơ coder chỉ hiện tên hiển thị, hạng và đánh giá; điều khoản cấm liên hệ riêng trước khi mở kết nối, vi phạm thì khóa tài khoản và mất tiền ký quỹ chưa giải ngân.
2. **Cùng accept sau POC**: nút accept chỉ mở sau khi khách đã chấp thuận sản phẩm POC; khi đó khách đồng ý đi tiếp với coder, coder đồng ý nhận, và sàn mở thông tin liên lạc cho cả hai. POC chưa được chấp thuận thì không có kết nối.
3. **Khách chọn hình thức triển khai**, theo bảng dưới.

| Lựa chọn | Sàn làm gì | Sàn thu gì (đề xuất) |
| --- | --- | --- |
| Làm trực tiếp | Mở liên lạc, chuyển repo nếu khách mua gói chuyển giao, sau đó rút khỏi quan hệ | Phí chuyển giao repo; không thu thêm phần triển khai |
| Sàn làm trung gian | Chia mốc và ký quỹ theo mốc, QA mỗi mốc, giải quyết tranh chấp, thay coder nếu bỏ ngang, xuất hóa đơn | Hoa hồng 8–12% mỗi mốc, thấp hơn mức POC |

Lựa chọn trung gian phải đủ hấp dẫn tự thân: khi rời sàn, hai bên mất bảo vệ thanh toán, hỗ trợ và giải quyết tranh chấp, đúng như Upwork cảnh báo người dùng của họ. Mức 8–12% là giả định cần kiểm chứng với khách thật.

## KPI, rủi ro và kế hoạch 90 ngày

Chỉ số bắc đẩu là **số POC giao đúng hạn và được nghiệm thu mỗi tuần**; mọi chỉ số khác phục vụ nó.

| KPI | Mục tiêu tháng 3 | Mục tiêu tháng 12 |
| --- | --- | --- |
| Đơn hoàn thành/tháng | 100 | 3.000 |
| Thời gian giao trung vị | ≤ 6 giờ | ≤ 4 giờ |
| Tỉ lệ nghiệm thu lần đầu | ≥ 70% | ≥ 80% |
| Thời gian ghép coder | ≤ 15 phút | ≤ 5 phút |
| Khách đặt lại trong 60 ngày | ≥ 30% | ≥ 50% |
| Khách báo POC giúp chốt deal | đo từ đầu | ≥ 25% |

| Rủi ro | Cách giảm |
| --- | --- |
| Chất lượng không đều, khách mất niềm tin | QA Gate bắt buộc, phân hạng coder, hoàn tiền rõ ràng |
| Khách và coder giao dịch ngoài sàn | Khóa liên lạc trong giai đoạn POC, mở khi hai bên cùng accept, kèm lựa chọn sàn làm trung gian triển khai |
| Phạm vi phình to ("thêm chút nữa") | Spec khóa trước khi build, thay đổi tạo đơn bổ sung |
| AI coding tool khiến khách tự làm | Bán thời gian của người bán hàng, không bán code; khách trả để khỏi phải tự làm |
| Thiếu coder giờ cao điểm | Giá động, thưởng giờ cao điểm, mở coder ở nhiều múi giờ |

**Kế hoạch 90 ngày**

- [ ] Tuần 1–2: phỏng vấn 20 presales/founder, chốt 5 loại POC phổ biến nhất
- [ ] Tuần 2–4: chạy concierge thủ công qua form + Zalo/Slack, 10 coder sáng lập, giao 20 đơn thật
- [ ] Tuần 4–8: build MVP (AI Brief, ghép đơn, theo dõi tiến độ, deploy, thanh toán ký quỹ)
- [ ] Tuần 8–10: 5 template đầu tiên, QA Gate bản đầu
- [ ] Tuần 10–12: mở beta đóng cho 50 khách, đạt 100 đơn/tháng, công bố 3 case study
