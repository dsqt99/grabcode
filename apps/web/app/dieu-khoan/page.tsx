import type { Metadata } from 'next';
import LegalDraft, { Pending } from '../../components/LegalDraft';
import { BRAND } from '@grabcode/contracts';


export const metadata: Metadata = { title: `Điều khoản sử dụng (bản nháp) — ${BRAND.name}` };

export default function TermsPage() {
  return (
    <LegalDraft title="Điều khoản sử dụng">
      <section>
        <h2>1. {BRAND.name} làm gì</h2>
        <ul>
          <li>{BRAND.name} kết nối người đặt làm app (khách) với freelancer làm app bằng công cụ AI.</li>
          <li>Khách mô tả yêu cầu; đặc tả và các mốc bàn giao được soạn trước khi đặt đơn và khách xem lại trước khi tạo đơn.</li>
          <Pending>Thông tin pháp nhân, vai trò của {BRAND.name} (sàn trung gian / bên thu hộ), phạm vi trách nhiệm.</Pending>
        </ul>
      </section>
      <section>
        <h2>2. Thanh toán</h2>
        <ul>
          <li>Khách chuyển khoản toàn bộ giá đơn vào tài khoản {BRAND.name} hiển thị ở trang thanh toán, với đúng nội dung chuyển khoản của đơn.</li>
          <li>Tiền được giữ tại {BRAND.name} và chỉ trả cho freelancer khi khách duyệt mốc / nghiệm thu đơn, hoặc theo kết quả xử lý tranh chấp.</li>
          <Pending>Phí dịch vụ, hoá đơn, nghĩa vụ thuế của các bên.</Pending>
        </ul>
      </section>
      <section>
        <h2>3. Bàn giao, nghiệm thu, tranh chấp</h2>
        <ul>
          <li>Freelancer bàn giao theo từng mốc. Khách duyệt hoặc yêu cầu sửa kèm ghi chú.</li>
          <li>Khi chưa đồng ý với bàn giao, khách có thể mở tranh chấp; {BRAND.name} xem xét và quyết định chia số tiền còn giữ.</li>
          <Pending>Thời hạn nghiệm thu, số vòng sửa, quyền sở hữu mã nguồn, bảo hành.</Pending>
        </ul>
      </section>
      <section>
        <h2>4. Tài khoản và dữ liệu</h2>
        <ul>
          <li>Khách cung cấp số điện thoại để {BRAND.name} liên hệ về đơn.</li>
          <Pending>Chính sách bảo vệ dữ liệu cá nhân, quyền và nghĩa vụ của người dùng, chấm dứt tài khoản.</Pending>
        </ul>
      </section>
    </LegalDraft>
  );
}
