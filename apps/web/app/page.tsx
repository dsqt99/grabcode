import ComparisonTable from '../components/ComparisonTable';
import InstantDispatch from '../components/InstantDispatch';
import Navbar from '../components/Navbar';
import TemplateShowcase from '../components/TemplateShowcase';

const STATS = [
  { value: '500+', label: 'Coder sẵn sàng' },
  { value: '2–8h', label: 'Thời gian ra demo' },
  { value: '100%', label: 'Hoàn tiền nếu trễ' },
  { value: '4.9/5', label: 'Điểm hài lòng' },
];

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 md:px-8 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="chip-ok mb-4">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-sonar rounded-full bg-emerald" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
              </span>
              Coder đang online ngay lúc này
            </span>
            <h1 className="font-display text-[30px] font-extrabold leading-9 tracking-tight text-ink md:text-5xl md:leading-[1.1]">
              Đặt POC như đặt đồ ăn. <span className="text-emerald">Có demo chạy thật</span> trong 2–8 giờ.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-slate-600">
              Mô tả ý tưởng, AI chuẩn hóa thành đặc tả, tiền được ký quỹ an toàn và Coder gần nhất nhận đơn trong vài giây.
            </p>
            <ul className="mt-6 space-y-2 text-slate-600">
              {['Ký quỹ bảo đảm, hoàn 100% nếu không đạt', 'Theo dõi từng commit theo thời gian thực', 'Nghiệm thu trên link demo, hài lòng mới giải ngân'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald" aria-hidden>check_circle</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <InstantDispatch />
        </section>

        <section aria-label="Số liệu" className="bg-ink">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 md:grid-cols-4 md:px-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <dd className="font-display text-3xl font-extrabold text-primary-fixed">{s.value}</dd>
                <dt className="text-sm text-slate-300">{s.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <TemplateShowcase />
        <ComparisonTable />

        <section className="mx-auto max-w-3xl px-4 pb-20 md:px-8">
          <figure className="card text-center shadow-l2">
            <span className="material-symbols-outlined text-emerald" aria-hidden>format_quote</span>
            <blockquote className="mt-2 font-display text-lg font-semibold text-ink">
              Sáng đặt đơn, trưa đã có link CRM chạy thật để show cho sếp. Tiền chỉ giải ngân khi tôi bấm nghiệm thu.
            </blockquote>
            <figcaption className="mt-3 text-sm text-slate-500">Nguyễn Văn Tuấn, An Gia Land</figcaption>
          </figure>
        </section>
      </main>
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
        © 2026 GrabCode. Sàn dispatch code siêu tốc.
      </footer>
    </>
  );
}
