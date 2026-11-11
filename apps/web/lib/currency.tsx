'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { formatMoney, type Currency } from './pricing';

interface Ctx {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  money: (vnd: number) => string;
}

// Signed-in users keep the preference on their core-api profile; guests / mock mode fall back to this browser.
const KEY = 'grabcode.currency';

const CurrencyContext = createContext<Ctx>({ currency: 'VND', setCurrency: () => {}, money: (v) => formatMoney(v) });

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { me, updateMe } = useAuth();
  const [local, setLocal] = useState<Currency>('VND');
  // Read after mount so server and first client render match (no hydration mismatch).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'VND' || saved === 'USD') setLocal(saved);
    } catch {}
  }, []);

  const currency = me?.currency ?? local;
  const setCurrency = (c: Currency) => {
    setLocal(c);
    try {
      localStorage.setItem(KEY, c);
    } catch {}
    if (me) updateMe({ currency: c }).catch((err) => console.warn('save currency failed:', err));
  };
  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, money: (v) => formatMoney(v, currency) }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);
