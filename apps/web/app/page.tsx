import ComparisonTable from '../components/ComparisonTable';
import InstantDispatch from '../components/InstantDispatch';
import Navbar from '../components/Navbar';
import TemplateShowcase from '../components/TemplateShowcase';
import { BRAND } from '@grabcode/contracts';


const STEPS = [
  { icon: 'restaurant_menu', title: 'Chọn món, ghi yêu cầu', text: 'Mô tả app bạn cần bằng tiếng Việt, như ghi chú cho quán.' },
  { icon: 'receipt_long', title: 'AI lên bill & mốc giao', text: 'AI chuyển mô tả thành đặc tả, báo giá và các mốc giao từng phần.' },
  { icon: 'qr_code_2', title: 'Thanh toán, tiền được giữ', text: `Quét VietQR, tiền được giữ ký quỹ trên ${BRAND.name}, chưa trả cho ai.` },
  { icon: 'code', title: 'Coder vibe code giao demo', text: 'Mỗi mốc giao xong, bạn xem demo rồi duyệt mới giải ngân.' },
];

const BULLETS = [
  'Demo giao theo ngày, không phải dự án kéo dài nhiều tháng',
  'Tiền giữ ký quỹ, chỉ giải ngân khi bạn duyệt từng mốc',
  'Chưa ưng thì trả đơn: yêu cầu sửa kèm ghi chú, tranh chấp có admin xử lý, không ai nhận đơn trong 24 giờ thì tự hoàn tiền',
];

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 md:px-8 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="chip-ok mb-4">
              <span className="material-symbols-outlined !text-[14px]" aria-hidden>delivery_dining</span>
              Đặt demo online, giao nhanh trong ngày
            </span>
            {/* tagline is a full sentence with its own punctuation: never append to it (docs/BRAND.md). */}
            <h1 className="text-balance font-display text-[30px] font-extrabold leading-9 tracking-tight text-ink md:text-5xl md:leading-[1.1]">
              {BRAND.tagline}
            </h1>
            <p className="mt-3 font-display text-xl font-bold text-ink md:text-2xl">
              <span className="text-emerald-dark">Coder vibe code nấu demo</span>, bạn nhận từng mốc mới trả tiền.
            </p>
            <p className="mt-4 max-w-xl text-lg text-slate-600">
              Mô tả ý tưởng như đặt món: AI lên đặc tả và bill, tiền được giữ ký quỹ, freelancer dùng công cụ AI làm nhanh rồi giao demo tận tay.
            </p>
            <ul className="mt-6 space-y-2 text-slate-600">
              {BULLETS.map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald" aria-hidden>check_circle</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <InstantDispatch />
        </section>

        <section aria-labelledby="how-title" className="bg-ink">
          <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
            <h2 id="how-title" className="mb-6 text-center font-display text-xl font-bold text-white md:text-2xl">Đặt demo như đặt đồ ăn</h2>
            <ol className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="text-center">
                  <span className="material-symbols-outlined text-3xl text-primary-fixed" aria-hidden>{s.icon}</span>
                  <p className="mt-2 font-display font-bold text-white">{i + 1}. {s.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <TemplateShowcase />
        <ComparisonTable />
      </main>
    </>
  );
}
