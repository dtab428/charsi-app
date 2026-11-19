import { coversEditionStamp, editionOf, finishOf, variantLabel, withoutGenericEditions, type Edition, type Finish } from "./format";
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

export function holoScan<T extends { id: string; rarity: string; large: string }>(card: T, printing: string | null, family: T[]): string {
  if (finishOf(printing) !== "holo") return card.large;
  if (/holo/i.test(card.rarity) && !/reverse/i.test(card.rarity)) return card.large;
  const twin = family.find((other) => other.id !== card.id && finishTwins(card.rarity, other.rarity) && /holo/i.test(other.rarity));
  return twin?.large || card.large;
}

export function unlimitedPicture(src: string): string {
  if (!src.startsWith("https://images.pokemontcg.io/")) return src;
  return `/api/image?src=${encodeURIComponent(src)}&cover=stamp`;
}

export function shownPicture(variants: VariantQuote[], activeKey: string | null, finish: Finish | null, small: string, large: string): string {
  const edition = editionOf(activeKey);
  // Both catalog sizes are usually the 1st edition photo. 1st edition
  // keeps that scan. Unlimited uses the same sharp photo with the stamp covered.
  if (edition === "first") return large || small;
  if (coversEditionStamp(activeKey)) return unlimitedPicture(large || small);
  const current = activeKey ? variants.find((variant) => variant.key === activeKey) : undefined;
  if (current?.image) return current.image;
  if (finish === "reverse") {
    const holo = variants.find((variant) => finishOf(variant.key) === "holo" && variant.image);
    if (holo?.image) return holo.image;
    // Reverse foil sits around the holo artwork.
    return large || small;
  }
  // On a lot of older holos the small scan is the flat art and the hires
  // scan is the holo photo. When they are the same picture, the hires is
  // just sharper.
  if (finish === "holo") return large || small;
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

const DISTINCT_RARITY = /illustration|hyper rare|ultra rare|secret|rainbow|shiny|ace spec/i;

// A holo and a non-holo of one card share a name. An illustration rare, a
// special illustration rare, and the regular card do not: each has its own number.
export function finishTwins(a: string, b: string): boolean {
  if (!a || !b || DISTINCT_RARITY.test(a) || DISTINCT_RARITY.test(b)) return false;
  const holo = (value: string) => /holo/i.test(value);
  return holo(a) !== holo(b);
}

export function printingFamily<T extends { id: string; setId: string; name: string; rarity?: string }>(card: T, alternatives: T[]): T[] {
  const name = card.name.toLowerCase();
  const rest = alternatives.filter((alt) => {
    if (alt.id === card.id || alt.setId !== card.setId || alt.name.toLowerCase() !== name) return false;
    if (card.rarity && alt.rarity) return finishTwins(card.rarity, alt.rarity);
    return true;
  });
  return [card, ...rest];
}

// TCGdex marks a holo-only card as normal:true and files its price under holofoil.
// That is one printing, not a non-holo plus a holo.
export function withFinishFlags(
  variants: VariantQuote[],
  flags: { normal?: boolean; holo?: boolean; reverse?: boolean } | null,
  productUrl: string | null,
): VariantQuote[] {
  if (!flags) return variants;
  const pricedHolo = variants.some((variant) => finishOf(variant.key) === "holo");
  const next = [...variants];
  const wanted: [boolean | undefined, string][] = [
    [flags.normal, "normal"],
    [flags.holo, "holofoil"],
    [flags.reverse, "reverseHolofoil"],
  ];
  for (const [on, key] of wanted) {
    if (on !== true) continue;
    if (next.some((variant) => variant.key === key || finishOf(variant.key) === finishOf(key))) continue;
    if (key === "normal" && pricedHolo && flags.holo !== true) continue;
    next.push({ key, label: variantLabel(key), market: null, low: null, mid: null, high: null, currency: "USD", productUrl });
  }
  return next;
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
