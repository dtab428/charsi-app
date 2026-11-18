import { editionOf, finishOf, withoutGenericEditions, type Edition, type Finish } from "./format";
import type { EuroSales, PriceQuote, PublicCard, VariantQuote } from "./types";

export function pickFinish(finish: Finish, variants: VariantQuote[]): VariantQuote | null {
  const hits = variants.filter((variant) => finishOf(variant.key) === finish);
  return hits.find((variant) => variant.market != null) ?? hits[0] ?? null;
}

export type ActiveVariant = { key: string | null; cardId: string | null; needsPick: boolean; missing: Finish | null };

function askedEdition(modifiers: string[]): Edition | null {
  if (modifiers.includes("shadowless")) return "shadowless";
  if (modifiers.includes("first")) return "first";
  if (modifiers.includes("unlimited")) return "unlimited";
  return null;
}

export function shownPicture(variants: VariantQuote[], activeKey: string | null, finish: Finish | null, small: string, large: string): string {
  const current = activeKey ? variants.find((variant) => variant.key === activeKey) : undefined;
  if (current?.image) return current.image;
  if (finish === "reverse") {
    const holo = variants.find((variant) => finishOf(variant.key) === "holo" && variant.image);
    if (holo?.image) return holo.image;
  }
  return small || large;
}

export function keptAfterChoice(previous: PublicCard | null, alternatives: PublicCard[], card: PublicCard): PublicCard[] {
  const name = card.name.toLowerCase();
  const pool = [previous, ...alternatives].filter((entry): entry is PublicCard => entry != null && entry.id !== card.id);
  const seen = new Set<string>();
  return pool.filter((entry) => {
    if (seen.has(entry.id) || entry.setId !== card.setId || entry.name.toLowerCase() !== name) return false;
    seen.add(entry.id);
    return true;
  });
}

export function printingFamily(card: PublicCard, alternatives: PublicCard[]): PublicCard[] {
  const name = card.name.toLowerCase();
  const rest = alternatives.filter((alt) => alt.setId === card.setId && alt.name.toLowerCase() === name && alt.id !== card.id);
  return [card, ...rest];
}

export function mergePrintings(groups: { cardId: string; variants: VariantQuote[] }[]): VariantQuote[] {
  const seen = new Set<string>();
  const merged: VariantQuote[] = [];
  for (const group of groups) {
    for (const variant of group.variants) {
      const identity = `${editionOf(variant.key) ?? "-"}:${finishOf(variant.key) ?? variant.key}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      merged.push({ ...variant, cardId: group.cardId });
    }
  }
  return withoutGenericEditions(merged);
}

export function resolveActive(input: {
  finish: Finish | null;
  modifiers: string[];
  variants: VariantQuote[];
  pickedKey: string | null;
  loaded: boolean;
}): ActiveVariant {
  const { finish, modifiers, variants, pickedKey, loaded } = input;
  const picked = pickedKey ? variants.find((variant) => variant.key === pickedKey) : undefined;
  if (picked) return { key: picked.key, cardId: picked.cardId ?? null, needsPick: false, missing: null };
  if (!loaded) return { key: null, cardId: null, needsPick: false, missing: null };

  const edition = askedEdition(modifiers);
  const editionKnown = edition != null && variants.some((variant) => editionOf(variant.key) === edition);
  const candidates = variants.filter((variant) => {
    const printed = finishOf(variant.key);
    if (finish && printed !== finish) return false;
    if (editionKnown && editionOf(variant.key) !== edition) return false;
    if (modifiers.includes("reverse") && printed !== "reverse") return false;
    if (modifiers.includes("nonholo") && printed !== "normal") return false;
    if (modifiers.includes("holo") && !modifiers.includes("reverse") && printed !== "holo") return false;
    return true;
  });

  if (candidates.length === 1) {
    const only = candidates[0] as VariantQuote;
    return { key: only.key, cardId: only.cardId ?? null, needsPick: false, missing: null };
  }
  if (candidates.length > 1) return { key: null, cardId: null, needsPick: true, missing: null };
  if (variants.length > 1) return { key: null, cardId: null, needsPick: true, missing: finish };
  const fallback = variants[0];
  return { key: fallback?.key ?? null, cardId: fallback?.cardId ?? null, needsPick: false, missing: finish && variants.length > 0 ? finish : null };
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

export function marketAmount(modifiers: string[], quote: PriceQuote | null | undefined, finish?: Finish | null, pickedKey?: string | null): number | null {
  const variants = quote?.variants ?? [];
  const active = resolveActive({ finish: finish ?? null, modifiers, variants, pickedKey: pickedKey ?? null, loaded: true });
  if (active.needsPick || !active.key) return null;
  return variants.find((variant) => variant.key === active.key)?.market ?? null;
}
