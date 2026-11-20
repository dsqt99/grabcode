import { BRAND } from '@grabcode/contracts';
const ROWS: { label: string; self: string; grab: string }[] = [
  { label: 'Đặc tả yêu cầu', self: 'Tự viết, dễ thiếu ý', grab: 'AI soạn đặc tả & mốc từ mô tả của bạn' },
  { label: 'Giữ tiền', self: 'Chuyển thẳng cho người làm', grab: `Giữ ký quỹ trên ${BRAND.name}` },
  { label: 'Thanh toán', self: 'Thoả thuận riêng', grab: 'Giải ngân theo từng mốc khi bạn duyệt' },
  { label: 'Khi chưa đạt', self: 'Tự thương lượng', grab: 'Yêu cầu sửa; tranh chấp có admin xử lý' },
  { label: 'Người làm', self: 'Tự tìm', grab: 'Freelancer vibe code làm app bằng công cụ AI' },
];

export default function ComparisonTable() {
  return (
    <section id="compare" aria-labelledby="cmp-title" className="mx-auto max-w-7xl px-4 py-16 md:px-8">
      <h2 id="cmp-title" className="mb-8 text-center font-display text-2xl font-bold text-ink md:text-3xl">
        Vì sao đặt qua {BRAND.name}?
      </h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-l2">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">So sánh tự thuê bên ngoài và đặt qua {BRAND.name}</caption>
          <thead>
            <tr className="font-display">
              <th scope="col" className="p-4 text-slate-400"><span className="sr-only">Tiêu chí</span></th>
              <th scope="col" className="p-4 font-bold text-slate-600">Tự thuê bên ngoài</th>
              <th scope="col" className="bg-emerald p-4 font-bold text-white">{BRAND.name}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label} className="border-t border-slate-100">
                <th scope="row" className="p-4 font-semibold text-ink">{r.label}</th>
                <td className="p-4 text-slate-500">{r.self}</td>
                <td className="bg-emerald-mint p-4 font-semibold text-emerald-dark">{r.grab}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
