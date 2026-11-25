import { BRAND } from '@grabcode/contracts';
const ROWS: { label: string; self: string; grab: string }[] = [
  { label: 'Đặc tả yêu cầu', self: 'Tự viết, dễ thiếu ý', grab: 'AI soạn đặc tả & mốc từ mô tả của bạn' },
  { label: 'Giữ tiền', self: 'Chuyển thẳng cho người làm', grab: `Giữ ký quỹ trên ${BRAND.name}` },
  { label: 'Thanh toán', self: 'Thoả thuận riêng', grab: 'Giải ngân theo từng mốc khi bạn duyệt' },
  { label: 'Khi chưa đạt', self: 'Tự thương lượng', grab: 'Yêu cầu sửa; tranh chấp có admin xử lý' },
  { label: 'Người làm', self: 'Tự tìm', grab: 'Freelancer trên chợ nhận đơn POC, làm bằng công cụ AI' },
];

export default function ComparisonTable() {
  return (
    <section id="compare" aria-labelledby="cmp-title" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-12 md:px-8 md:py-16">
      <h2 id="cmp-title" className="mb-6 font-display text-2xl font-extrabold text-stone-900 md:mb-8 md:text-center md:text-3xl">
        Vì sao đặt qua {BRAND.name}?
      </h2>

      {/* Mobile: one card per row instead of a horizontally scrolling table (axe scrollable-region-focusable). */}
      <ul className="space-y-3 md:hidden">
        {ROWS.map((r) => (
          <li key={r.label} className="card space-y-2">
            <h3 className="font-display text-base font-bold text-stone-900">{r.label}</h3>
            <p className="text-sm text-stone-600">Tự thuê bên ngoài: {r.self}</p>
            <p className="flex items-start gap-2 text-sm font-semibold text-brand-800">
              <span className="material-symbols-outlined !text-[20px]" aria-hidden>check_circle</span>
              <span>{BRAND.name}: {r.grab}</span>
            </p>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-2xl border border-stone-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">So sánh tự thuê bên ngoài và đặt qua {BRAND.name}</caption>
          <thead>
            <tr className="font-display">
              <th scope="col" className="p-4"><span className="sr-only">Tiêu chí</span></th>
              <th scope="col" className="p-4 font-bold text-stone-600">Tự thuê bên ngoài</th>
              <th scope="col" className="bg-brand-700 p-4 font-bold text-white">{BRAND.name}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label} className="border-t border-stone-100">
                <th scope="row" className="p-4 font-semibold text-stone-900">{r.label}</th>
                <td className="p-4 text-stone-600">{r.self}</td>
                <td className="bg-brand-50 p-4 font-semibold text-brand-800">{r.grab}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
