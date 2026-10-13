'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { formatMoney, type Currency } from './pricing';

interface Ctx {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  money: (vnd: number) => string;
}

const CurrencyContext = createContext<Ctx>({ currency: 'VND', setCurrency: () => {}, money: (v) => formatMoney(v) });

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('VND');
  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, money: (v) => formatMoney(v, currency) }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);
