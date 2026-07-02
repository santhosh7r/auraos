"use client";

import * as React from "react";
import { setActiveCurrency, getActiveCurrency, type Currency } from "@/lib/utils";

interface CurrencyState {
  currency: Currency;
  setCurrency: (c: Currency) => void;
}

const CurrencyContext = React.createContext<CurrencyState | null>(null);
const STORAGE_KEY = "aura.currency";

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = React.useState<Currency>(getActiveCurrency());

  // Apply the persisted choice after mount (avoids SSR/client mismatch).
  React.useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "USD" || saved === "INR") {
      setActiveCurrency(saved);
      setCurrencyState(saved);
    }
  }, []);

  const setCurrency = React.useCallback((c: Currency) => {
    setActiveCurrency(c);
    localStorage.setItem(STORAGE_KEY, c);
    setCurrencyState(c);
  }, []);

  const value = React.useMemo(() => ({ currency, setCurrency }), [currency, setCurrency]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = React.useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
