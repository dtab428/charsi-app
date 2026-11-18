import { finishOf, type Finish } from "./format";
import type { EuroSales, PriceQuote, VariantQuote } from "./types";

export function pickFinish(finish: Finish, variants: VariantQuote[]): VariantQuote | null {
  const hits = variants.filter((variant) => finishOf(variant.key) === finish);
  return hits.find((variant) => variant.market != null) ?? hits[0] ?? null;
}

export type ActiveVariant = { key: string | null; needsPick: boolean; missing: Finish | null };

export function resolveActive(input: {
  finish: Finish | null;
  modifiers: string[];
  variants: VariantQuote[];
  pickedKey: string | null;
  loaded: boolean;
}): ActiveVariant {
  const { finish, modifiers, variants, pickedKey, loaded } = input;
  if (pickedKey && variants.some((variant) => variant.key === pickedKey)) return { key: pickedKey, needsPick: false, missing: null };
  let missing: Finish | null = null;
  if (finish) {
    const hit = pickFinish(finish, variants);
    if (hit) return { key: hit.key, needsPick: false, missing: null };
    if (loaded && variants.length > 0) missing = finish;
  }
  const finishes = new Set(variants.map((variant) => finishOf(variant.key)).filter(Boolean));
  const needsPick = loaded && !finish && finishes.size >= 2;
  return { key: needsPick ? null : pickVariant(modifiers, variants)?.key ?? null, needsPick, missing };
}

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

export function marketAmount(modifiers: string[], quote: PriceQuote | null | undefined, finish?: Finish | null): number | null {
  const variants = quote?.variants ?? [];
  const variant = (finish ? pickFinish(finish, variants) : null) ?? pickVariant(modifiers, variants);
  return variant?.market ?? null;
}
