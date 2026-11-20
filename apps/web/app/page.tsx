import ComparisonTable from '../components/ComparisonTable';
import InstantDispatch from '../components/InstantDispatch';
import Navbar from '../components/Navbar';
import TemplateShowcase from '../components/TemplateShowcase';

const STEPS = [
  { icon: 'edit_note', title: 'Mô tả yêu cầu', text: 'Viết vài dòng về app bạn cần, bằng tiếng Việt.' },
  { icon: 'auto_awesome', title: 'AI soạn đặc tả & mốc', text: 'AI chuyển mô tả thành đặc tả và các mốc bàn giao.' },
  { icon: 'qr_code_2', title: 'Chuyển khoản ký quỹ', text: 'Quét VietQR, tiền được giữ ký quỹ trên GrabCode.' },
  { icon: 'task_alt', title: 'Bàn giao từng mốc', text: 'Freelancer làm và gửi link từng mốc, bạn duyệt mới giải ngân.' },
];

const BULLETS = [
  'Tiền giữ ký quỹ, chỉ giải ngân khi bạn duyệt từng mốc',
  'Chưa đạt thì yêu cầu sửa kèm ghi chú',
  'Tranh chấp có admin xử lý; tự hoàn tiền nếu không có freelancer nhận trong 24 giờ',
];

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 md:px-8 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="chip-ok mb-4">
              <span className="material-symbols-outlined !text-[14px]" aria-hidden>storefront</span>
              Dành cho chủ shop & SME Việt Nam
            </span>
            <h1 className="font-display text-[30px] font-extrabold leading-9 tracking-tight text-ink md:text-5xl md:leading-[1.1]">
              Đặt làm app như đặt đồ ăn. <span className="text-emerald">Freelancer vibe code làm</span>, bạn duyệt từng mốc mới trả tiền.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-slate-600">
              Mô tả ý tưởng, AI soạn thành đặc tả và các mốc bàn giao, tiền được giữ ký quỹ và freelancer làm app bằng công cụ AI nhận đơn.
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
            <h2 id="how-title" className="mb-6 text-center font-display text-xl font-bold text-white md:text-2xl">Cách hoạt động</h2>
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
