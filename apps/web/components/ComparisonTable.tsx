const ROWS: { label: string; agency: string; freelancer: string; grab: string }[] = [
  { label: 'Thời gian có demo', agency: '2–6 tuần', freelancer: '1–2 tuần', grab: '2–8 giờ' },
  { label: 'Chi phí POC', agency: '50–200 triệu', freelancer: '8–30 triệu', grab: 'Từ 2,2 triệu' },
  { label: 'Bảo vệ tiền cọc', agency: 'Hợp đồng giấy', freelancer: 'Không có', grab: 'Ký quỹ, hoàn 100%' },
  { label: 'Theo dõi tiến độ', agency: 'Báo cáo tuần', freelancer: 'Nhắn tin hỏi', grab: 'Realtime theo commit' },
  { label: 'Kiểm thử chất lượng', agency: 'Tuỳ đội ngũ', freelancer: 'Tự lo', grab: 'QA Gate tự động' },
];

export default function ComparisonTable() {
  return (
    <section id="compare" aria-labelledby="cmp-title" className="mx-auto max-w-7xl px-4 py-16 md:px-8">
      <h2 id="cmp-title" className="mb-8 text-center font-display text-2xl font-bold text-ink md:text-3xl">
        Vì sao chọn GrabCode thay vì Agency hay Freelancer?
      </h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-l2">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">So sánh Agency, Freelancer và GrabCode</caption>
          <thead>
            <tr className="font-display">
              <th scope="col" className="p-4 text-slate-400"><span className="sr-only">Tiêu chí</span></th>
              <th scope="col" className="p-4 font-bold text-slate-600">Agency</th>
              <th scope="col" className="p-4 font-bold text-slate-600">Freelancer</th>
              <th scope="col" className="bg-emerald p-4 font-bold text-white">GrabCode</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label} className="border-t border-slate-100">
                <th scope="row" className="p-4 font-semibold text-ink">{r.label}</th>
                <td className="p-4 text-slate-500">{r.agency}</td>
                <td className="p-4 text-slate-500">{r.freelancer}</td>
                <td className="bg-emerald-mint p-4 font-semibold text-emerald-dark">{r.grab}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
