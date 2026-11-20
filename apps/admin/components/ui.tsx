'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';

/** Loads `path`, renders a table; `act` runs a mutation then reloads, showing the API error inline. */
export function useList<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<T>(path).then(setData, (e: Error) => setError(e.message)), [path]);
  useEffect(() => void load(), [load]);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { data, error, busy, act, load };
}

/** `loading` shows skeleton rows: an empty-looking table while loading could hide money waiting for the admin. */
export function Table({ head, children, empty, error, loading = false }: { head: string[]; children: ReactNode[]; empty: string; error: string | null; loading?: boolean }) {
  return (
    <section className="table-wrap" aria-busy={loading}>
      {error && (
        <div className="banner-danger m-3" role="alert">
          <span className="material-symbols-outlined" aria-hidden>error</span>
          <p>{error}</p>
        </div>
      )}
      <table className="table">
        <thead>
          <tr>{head.map((h, i) => <th key={`${h}${i}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {loading
            ? [0, 1, 2].map((i) => (
                <tr key={i}>
                  <td colSpan={head.length}><div className="skeleton h-12" /></td>
                </tr>
              ))
            : children}
        </tbody>
      </table>
      {loading && <span className="sr-only">Đang tải…</span>}
      {!loading && children.length === 0 && <p className="p-6 text-center text-stone-600">{empty}</p>}
    </section>
  );
}

export const loadingOf = (data: unknown, error: string | null) => data === null && !error;

/** Status chip: Vietnamese label + class. */
export function Chip({ tone, children }: { tone: 'warn' | 'info' | 'progress' | 'success' | 'danger' | 'neutral'; children: ReactNode }) {
  return <span className={`chip-${tone}`}>{children}</span>;
}

/** Filter/hint row on top of a tab. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}
