import type { ReactNode } from 'react';
import Navbar from './Navbar';
import SupportContact from './SupportContact';

/** Placeholder for text only the founder / lawyer may write. Never fill it in from code. */
export const Pending = ({ children }: { children: ReactNode }) => (
  <li className="rounded-md border border-dashed border-amber-text/50 bg-amber-tint/40 p-3 text-amber-text">[Chờ founder cung cấp] {children}</li>
);

/**
 * Legal page shell (P0-9). The wording is a DRAFT until the founder approves it: the banner says so, and the body only
 * describes how the product works today; terms that need a legal decision stay as [Chờ founder cung cấp].
 */
export default function LegalDraft({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8">
        <p className="rounded-lg border-2 border-amber-text bg-amber-tint p-4 font-display font-extrabold text-amber-text" role="note">
          BẢN NHÁP – chờ founder duyệt. Nội dung chưa có giá trị pháp lý chính thức.
        </p>
        <h1 className="font-display text-2xl font-extrabold text-ink md:text-3xl">{title}</h1>
        <div className="space-y-6 text-slate-700 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {children}
        </div>
        <p className="text-sm">
          Thắc mắc: <SupportContact />
        </p>
      </main>
    </>
  );
}
