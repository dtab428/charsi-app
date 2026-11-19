export const CURRENCIES = [
  { code: "USD", label: "US dollars" },
  { code: "EUR", label: "Euros" },
  { code: "GBP", label: "Pounds" },
  { code: "CAD", label: "Canadian dollars" },
  { code: "AUD", label: "Australian dollars" },
  { code: "JPY", label: "Yen" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export type FxTable = { base: "USD"; date: string; rates: Record<string, number> };

export function currencyCode(value: string | null | undefined): CurrencyCode {
  const code = value?.toUpperCase();
  return CURRENCIES.some((entry) => entry.code === code) ? (code as CurrencyCode) : "USD";
}

// Rates are units of each currency per one US dollar, the European Central Bank reference.
export function convert(amount: number, from: string, to: string, table: FxTable | null): number | null {
  const source = from.toUpperCase();
  const target = to.toUpperCase();
  if (!Number.isFinite(amount)) return null;
  if (source === target) return amount;
  if (!table) return null;
  const rates: Record<string, number> = { USD: 1, ...table.rates };
  const fromRate = rates[source];
  const toRate = rates[target];
  if (!fromRate || !toRate) return null;
  return (amount / fromRate) * toRate;
}
