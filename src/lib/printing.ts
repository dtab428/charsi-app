import type { VariantQuote } from "./types";

export function printingSlug(key: string): string {
  return key
    .replace(/Holofoil/g, "Holo")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

export function findPrinting(variants: VariantQuote[], slug: string | null | undefined): VariantQuote | null {
  if (!slug) return null;
  return variants.find((variant) => printingSlug(variant.key) === slug) ?? null;
}

export function printingName(slug: string): string {
  return slug
    .split("-")
    .map((part) => (part === "holo" ? "Holo" : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

export function cardHref(cardId: string, printing?: string | null): string {
  return printing ? `/card/${cardId}/${printing}` : `/card/${cardId}`;
}
