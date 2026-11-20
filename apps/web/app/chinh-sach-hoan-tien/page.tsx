import type { Metadata } from 'next';
import LegalDraft, { Pending } from '../../components/LegalDraft';

export const metadata: Metadata = { title: 'Chính sách hoàn tiền (bản nháp) — GrabCode' };

export default function RefundPolicyPage() {
  return (
    <LegalDraft title="Chính sách hoàn tiền">
      <section>
        <h2>1. Khi nào được hoàn tiền</h2>
        <ul>
          <li>Đơn đã thanh toán mà không có freelancer nào nhận trong 24 giờ kể từ khi GrabCode nhận đủ tiền: đơn tự huỷ và được hoàn toàn bộ.</li>
          <li>Chuyển thừa so với giá đơn: phần thừa được hoàn.</li>
          <li>Tranh chấp: số tiền hoàn theo quyết định xử lý tranh chấp của GrabCode.</li>
          <Pending>Các trường hợp khác (khách tự huỷ, freelancer bỏ đơn) và các trường hợp không hoàn tiền.</Pending>
        </ul>
      </section>
      <section>
        <h2>2. Cách hoàn tiền</h2>
        <ul>
          <li>GrabCode chuyển khoản hoàn tiền vào tài khoản ngân hàng bạn khai báo ở trang đơn (mục &quot;Tài khoản nhận hoàn tiền&quot;).</li>
          <li>Khoản tiền đã trả cho freelancer sau khi bạn duyệt mốc không được hoàn lại.</li>
          <Pending>Thời hạn chuyển hoàn, phí chuyển khoản, cách khiếu nại.</Pending>
        </ul>
      </section>
    </LegalDraft>
  );
}
