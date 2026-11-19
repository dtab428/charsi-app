import { editionOf, finishOf, variantLabel, type Finish } from "./format";
import type { VariantQuote } from "./types";

// TCGplayer files Base Set as two products. The Base Set product is the
// shadowed unlimited printing, and its price guide calls that printing
// Holofoil or Normal. The Base Set (Shadowless) product carries 1st edition
// and unlimited shadowless, which is why a single "holofoil" quote hides the choice.
export type BaseEditionRow = {
  name: string;
  number: string;
  key: string;
  market: number | null;
  low: number | null;
  mid: number | null;
  high: number | null;
  productId: number;
};

type ProductRow = { productId: number; name: string; number: string | null };
type PriceRow = { productId: number; subTypeName: string; lowPrice?: unknown; midPrice?: unknown; highPrice?: unknown; marketPrice?: unknown };

export function printedNumber(value: string | null | undefined): string | null {
  const match = /^0*(\d+)/.exec((value ?? "").trim());
  return match ? String(Number(match[1])) : null;
}

function sale(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  // 100000 is the placeholder TCGplayer writes when a printing has no sales market.
  if (!Number.isFinite(number) || number <= 0 || number >= 100_000) return null;
  return number;
}

export function editionKey(group: "base" | "shadowless", subtype: string): string | null {
  const holo = /holo/i.test(subtype);
  const first = /1st|first/i.test(subtype);
  if (group === "base") {
    if (holo) return "unlimitedHolofoil";
    if (/^normal$/i.test(subtype)) return "unlimited";
    return null;
  }
  if (first && holo) return "firstEditionShadowlessHolofoil";
  if (first) return "firstEditionShadowless";
  if (holo) return "unlimitedShadowlessHolofoil";
  if (/unlimited/i.test(subtype) || /^normal$/i.test(subtype)) return "unlimitedShadowless";
  return null;
}

export function baseEditionRows(products: ProductRow[], prices: PriceRow[], group: "base" | "shadowless"): BaseEditionRow[] {
  const byId = new Map(products.map((product) => [product.productId, product]));
  const rows: BaseEditionRow[] = [];
  for (const price of prices) {
    const product = byId.get(price.productId);
    const number = printedNumber(product?.number);
    if (!product || !number || product.name.includes("(")) continue;
    const key = editionKey(group, price.subTypeName);
    if (!key) continue;
    rows.push({
      name: product.name,
      number,
      key,
      market: sale(price.marketPrice),
      low: sale(price.lowPrice),
      mid: sale(price.midPrice),
      high: sale(price.highPrice),
      productId: product.productId,
    });
  }
  return rows;
}

export function applyBaseEditions(variants: VariantQuote[], rows: BaseEditionRow[]): VariantQuote[] | null {
  if (variants.some((variant) => editionOf(variant.key))) return null;
  const finishes = new Set(variants.map((variant) => finishOf(variant.key)).filter((finish): finish is Finish => finish != null));
  const matched = new Map<string, BaseEditionRow>();
  for (const row of rows) {
    const finish = finishOf(row.key);
    if (!finish || (finishes.size > 0 && !finishes.has(finish)) || matched.has(row.key)) continue;
    matched.set(row.key, row);
  }
  if (matched.size < 2) return null;
  return [...matched.values()].map((row) => ({
    key: row.key,
    label: variantLabel(row.key),
    market: row.market,
    low: row.low,
    mid: row.mid,
    high: row.high,
    currency: "USD",
    productUrl: `https://www.tcgplayer.com/product/${row.productId}`,
  }));
}
