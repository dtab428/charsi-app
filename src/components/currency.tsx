"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { money } from "@/lib/format";
import { CURRENCIES, convert, currencyCode, type CurrencyCode, type FxTable } from "@/lib/fx";

const KEY = "charsi.currency";

type CurrencyValue = {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  table: FxTable | null;
  format: (amount: number | null | undefined, source: string) => string;
  present: (amount: number, source: string) => { amount: number; currency: string };
};

const CurrencyContext = createContext<CurrencyValue | null>(null);

const currencyListeners = new Set<() => void>();

function readCurrency(): CurrencyCode {
  if (typeof window === "undefined") return "USD";
  return currencyCode(localStorage.getItem(KEY));
}

function subscribeCurrency(listener: () => void) {
  currencyListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    currencyListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function writeCurrency(code: CurrencyCode) {
  localStorage.setItem(KEY, code);
  currencyListeners.forEach((listener) => listener());
}

let rates: FxTable | null = null;
let ratesStarted = false;
const rateListeners = new Set<() => void>();

function subscribeRates(listener: () => void) {
  rateListeners.add(listener);
  if (!ratesStarted) {
    ratesStarted = true;
    fetch("/api/fx")
      .then((response) => (response.ok ? (response.json() as Promise<FxTable>) : null))
      .then((value) => {
        if (!value?.rates) return;
        rates = value;
        rateListeners.forEach((notify) => notify());
      })
      .catch(() => undefined);
  }
  return () => rateListeners.delete(listener);
}

function getRates() {
  return rates;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const currency = useSyncExternalStore(subscribeCurrency, readCurrency, () => "USD" as CurrencyCode);
  const table = useSyncExternalStore(subscribeRates, getRates, () => null);
  const setCurrency = useCallback((code: CurrencyCode) => writeCurrency(code), []);
  const format = useCallback(
    (amount: number | null | undefined, source: string) => {
      if (amount == null || !Number.isFinite(amount)) return "—";
      const converted = convert(amount, source, currency, table);
      if (converted == null) return money(amount, source);
      return money(converted, currency);
    },
    [currency, table],
  );
  const present = useCallback(
    (amount: number, source: string) => {
      const converted = convert(amount, source, currency, table);
      return converted == null ? { amount, currency: source } : { amount: converted, currency };
    },
    [currency, table],
  );
  const value = useMemo(() => ({ currency, setCurrency, table, format, present }), [currency, setCurrency, table, format, present]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyValue {
  const value = useContext(CurrencyContext);
  if (!value) throw new Error("Currency is missing");
  return value;
}

export function CurrencySelect() {
  const { currency, setCurrency, table } = useCurrency();
  const dated = table?.date ? `European Central Bank rate for ${table.date}.` : "European Central Bank rate, loading.";
  return (
    <label className="inline-flex items-center gap-1.5 text-sm text-[#f3ecdf]">
      <span className="sr-only">Currency</span>
      <select
        aria-label="Currency"
        title={dated}
        value={currency}
        onChange={(event) => setCurrency(currencyCode(event.target.value))}
        className="h-8 rounded-full border border-white/15 bg-transparent px-2 text-sm"
      >
        {CURRENCIES.map((entry) => (
          <option key={entry.code} value={entry.code} className="bg-[#14110e]">
            {entry.code}
          </option>
        ))}
      </select>
    </label>
  );
}
