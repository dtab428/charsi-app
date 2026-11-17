import type { EuroSales, PriceQuote, VariantQuote } from "./types";

export function pickVariant(modifiers: string[], variants: VariantQuote[]): VariantQuote | null {
  if (variants.length === 0) return null;
  const prefer = modifiers.includes("reverse")
    ? /reverse/i
    : modifiers.includes("first")
      ? /1st|first/i
      : modifiers.includes("shadowless")
        ? /shadowless/i
        : modifiers.includes("holo")
          ? /holo/i
          : null;
  if (prefer) {
    const hit = variants.find((variant) => {
      if (!prefer.test(`${variant.key} ${variant.label}`)) return false;
      if (modifiers.includes("holo") && !modifiers.includes("reverse") && /reverse/i.test(variant.key)) return false;
      return true;
    });
    if (hit) return hit;
  }
  for (const key of ["normal", "holofoil", "unlimitedHolofoil", "reverseHolofoil"]) {
    const hit = variants.find((variant) => variant.key === key && variant.market != null);
    if (hit) return hit;
  }
  return variants.find((variant) => variant.market != null) ?? variants[0] ?? null;
}

export function saleAverages(quote: PriceQuote | null | undefined, variant: VariantQuote | null): (EuroSales & { currency: "EUR" }) | null {
  const market = quote?.cardmarket;
  if (!market) return null;
  const holo = variant && /holo/i.test(variant.key) && !/reverse/i.test(variant.key) ? market.holo : null;
  const picked = holo && (holo.avg1 != null || holo.avg7 != null || holo.avg30 != null || holo.trend != null) ? holo : market;
  if (picked.avg1 == null && picked.avg7 == null && picked.avg30 == null && picked.trend == null) return null;
  return { ...picked, currency: "EUR" };
}

export function marketAmount(modifiers: string[], quote: PriceQuote | null | undefined): number | null {
  const variant = pickVariant(modifiers, quote?.variants ?? []);
  return variant?.market ?? null;
}
