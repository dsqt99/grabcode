import Link from 'next/link';
import ComparisonTable from '../components/ComparisonTable';
import InstantDispatch from '../components/InstantDispatch';
import Navbar from '../components/Navbar';
import TemplateShowcase from '../components/TemplateShowcase';
import { BRAND } from '@grabcode/contracts';


const STEPS = [
  { icon: 'edit_note', title: 'Chọn gói POC, ghi yêu cầu', text: 'Mô tả demo bạn cần bằng tiếng Việt: một tính năng chính, làm ngắn, chi phí nhỏ.' },
  { icon: 'auto_awesome', title: 'AI soạn đặc tả & báo giá', text: 'AI chuyển mô tả thành đặc tả ngắn; báo giá chốt (dưới 3 triệu đồng) và mốc giao.' },
  { icon: 'qr_code_2', title: 'Thanh toán, tiền được giữ', text: `Quét VietQR, tiền được giữ ký quỹ trên ${BRAND.name}, chưa trả cho ai.` },
  { icon: 'inventory_2', title: 'Freelancer nhận đơn, giao demo', text: 'Freelancer nhận đơn trên chợ và giao demo chạy được. Bạn xem demo rồi duyệt mới giải ngân.' },
];

const PROMISES = [
  { icon: 'shield_lock', text: 'Tiền giữ ký quỹ, chỉ trả khi bạn duyệt từng mốc' },
  { icon: 'edit', text: 'Chưa ưng thì yêu cầu sửa kèm ghi chú' },
  { icon: 'undo', text: 'Không ai nhận đơn trong 24 giờ thì tự hoàn tiền' },
];

/** "Tiền của bạn đi đâu?": only policies the product already enforces (redesign-web-home §1.4). */
const MONEY_STEPS = [
  { icon: 'request_quote', title: `${BRAND.name} báo giá chốt`, text: 'Bạn xem giá trước, chưa phải trả gì.' },
  { icon: 'qr_code_2', title: 'Bạn chuyển khoản VietQR', text: `Tiền vào ${BRAND.name} giữ, chưa trả cho freelancer.` },
  { icon: 'task_alt', title: 'Duyệt từng mốc', text: 'Mỗi mốc bạn duyệt, phần tiền của mốc đó mới được trả.' },
  { icon: 'verified', title: 'Nghiệm thu cả đơn', text: 'Tiền mốc cuối chỉ trả khi bạn nghiệm thu.' },
];

const MONEY_CASES = [
  { when: 'Chưa ưng mốc nào', then: 'Yêu cầu sửa, freelancer làm lại.' },
  { when: 'Không thống nhất', then: `Mở tranh chấp, tiền còn giữ bị tạm khoá tới khi ${BRAND.name} xử lý.` },
  { when: 'Không ai nhận đơn trong 24 giờ', then: `Đơn tự huỷ, ${BRAND.name} hoàn tiền vào tài khoản bạn khai báo.` },
];

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <section className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-8 px-4 py-8 md:px-8 lg:grid-cols-2 lg:gap-12 lg:py-16">
          <div>
            <span className="chip-progress mb-4">
              <span className="material-symbols-outlined !text-[16px]" aria-hidden>storefront</span>
              Chợ POC demo ngắn · dưới 3 triệu đồng
            </span>
            {/* tagline is a full sentence with its own punctuation: never append to it (docs/BRAND.md). */}
            <h1 className="text-balance font-display text-[30px] font-extrabold leading-9 tracking-tight text-stone-900 md:text-5xl md:leading-[1.1]">
              {BRAND.tagline}
            </h1>
            <p className="mt-3 font-display text-xl font-bold text-stone-900 md:text-2xl">
              <span className="text-brand-800">Freelancer nhận đơn làm demo</span>, bạn xem demo rồi mới trả tiền.
            </p>
            <p className="mt-4 max-w-xl text-lg text-stone-600">
              Đặt một bản POC/demo ngắn để thử ý tưởng, không phải sản phẩm đầy đủ: AI soạn đặc tả và báo giá, tiền được giữ ký quỹ, freelancer nhận đơn làm nhanh rồi giao demo cho bạn xem.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {PROMISES.map((p) => (
                <li key={p.icon} className="flex gap-3 rounded-xl border border-stone-200 bg-white p-3">
                  <span className="material-symbols-outlined text-brand-700" aria-hidden>{p.icon}</span>
                  <span className="text-sm font-semibold text-stone-900">{p.text}</span>
                </li>
              ))}
            </ul>
            <a href="#dispatch" className="btn-primary mt-6 w-full scroll-smooth lg:hidden">
              Đặt POC demo
              <span className="material-symbols-outlined !text-[20px]" aria-hidden>arrow_downward</span>
            </a>
          </div>
          <InstantDispatch />
        </section>

        <section id="money" aria-labelledby="money-title" className="scroll-mt-20 border-y border-stone-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
            <h2 id="money-title" className="font-display text-2xl font-extrabold text-stone-900 md:text-3xl">Tiền của bạn đi đâu?</h2>
            <ol className="mt-6 grid gap-0 md:grid-cols-4 md:gap-6">
              {MONEY_STEPS.map((s, i) => (
                <li key={s.title} className="relative flex gap-4 pb-6 md:flex-col md:gap-3 md:pb-0">
                  {/* connector: vertical on mobile, horizontal on desktop */}
                  {i < MONEY_STEPS.length - 1 && (
                    <span className="absolute left-4 top-8 h-[calc(100%-2rem)] w-px bg-stone-200 md:left-8 md:top-4 md:h-px md:w-[calc(100%-1rem)]" aria-hidden />
                  )}
                  <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink font-display text-sm font-bold text-white">{i + 1}</span>
                  <div>
                    <p className="flex items-center gap-2 font-display font-bold text-stone-900">
                      <span className="material-symbols-outlined !text-[20px] text-brand-700" aria-hidden>{s.icon}</span>
                      {s.title}
                    </p>
                    <p className="mt-1 text-sm text-stone-600">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <ul className="mt-8 grid gap-3 md:grid-cols-3">
              {MONEY_CASES.map((c) => (
                <li key={c.when} className="rounded-xl bg-stone-50 p-4 text-sm text-stone-700">
                  <span className="font-display font-bold text-stone-900">Nếu {c.when.charAt(0).toLowerCase() + c.when.slice(1)}</span>
                  <span aria-hidden> → </span>
                  <span className="sr-only">: </span>
                  {c.then}
                </li>
              ))}
            </ul>
            <Link href="/chinh-sach-hoan-tien" className="mt-4 inline-flex min-h-[44px] items-center font-semibold text-brand-800 underline">
              Đọc Chính sách hoàn tiền
            </Link>
          </div>
        </section>

        <section aria-labelledby="how-title" className="bg-ink">
          <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
            <h2 id="how-title" className="mb-8 font-display text-2xl font-extrabold text-white md:text-center md:text-3xl">Đặt POC demo, xem rồi mới chốt</h2>
            <ol className="grid grid-cols-1 gap-6 md:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4 md:flex-col md:items-center md:text-center">
                  <span className="material-symbols-outlined text-3xl text-brand-300" aria-hidden>{s.icon}</span>
                  <div>
                    <p className="font-display font-bold text-white">{i + 1}. {s.title}</p>
                    <p className="mt-1 text-sm text-stone-300">{s.text}</p>
                  </div>
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
