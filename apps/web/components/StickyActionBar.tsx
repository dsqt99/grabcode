import type { ReactNode } from 'react';

/**
 * Main CTA pinned to the bottom of the screen on mobile (UX spec P1-1), back in the flow from lg. The body gets bottom
 * padding while one is mounted (globals.css, data-sticky-bar) so it never hides the end of the page.
 */
export default function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div
      data-sticky-bar
      className="fixed inset-x-0 bottom-0 z-40 space-y-2 border-t border-stone-200 bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-sheet backdrop-blur lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none"
    >
      {children}
    </div>
  );
}
