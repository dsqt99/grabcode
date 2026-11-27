/** Biểu tượng vuông Ai Code AI: khung 4 góc + chữ "AI". Bản dựng lại SVG theo logo founder (HON-66), cùng hình với apps/web/app/icon1.svg. */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false" className={className}>
      <rect width="64" height="64" rx="14" fill="#0B44CC" />
      <g fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="butt" strokeLinejoin="miter">
      <path d="M10 21V10h11"/><path d="M43 10h11v11"/><path d="M54 43v11H43"/><path d="M21 54H10V43"/></g>
      <g fill="#fff" transform="translate(1.5 0)"><path fillRule="evenodd" d="M17 41 23.2 23h4.6L34 41h-4.8L28 37.4h-5L21.8 41ZM24.1 33.6h2.8l-1.4-4.2Z"/><rect x="38" y="23" width="5" height="18"/></g>
    </svg>
  );
}
