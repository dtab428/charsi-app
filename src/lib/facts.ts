import { money, percent } from "./format";
import { cardmarketSearchUrl, ebaySearchUrl, facebookSearchUrl, httpsHref, tcgplayerSearchUrl } from "./links";
import type { EuroSales, ListingLane, Pin, PriceQuote, PublicCard, VariantQuote } from "./types";

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
  for (const key of ["holofoil", "normal", "unlimitedHolofoil", "reverseHolofoil"]) {
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

export type CardFact = {
  id: string;
  kicker: string;
  value: string;
  detail: string;
  href: string | null;
};

export function cardFacts(
  card: PublicCard,
  modifiers: string[],
  quote: PriceQuote | null | undefined,
  loading: boolean,
  auctions: ListingLane,
  buyNow: ListingLane,
  pin: Pin,
): CardFact[] {
  const variant = pickVariant(modifiers, quote?.variants ?? []);
  const sales = saleAverages(quote, variant);
  const marketHref = httpsHref(quote?.productUrl, tcgplayerSearchUrl(card));
  const cardmarketHref = httpsHref(quote?.cardmarket?.url, cardmarketSearchUrl(card));
  const graded = quote?.graded ?? [];
  const week = quote?.trends.find((point) => point.days === 7) ?? quote?.trends[0];
  const auction = auctions.listings[0];
  const bin = buyNow.listings[0];

  const raw: CardFact = {
    id: "market",
    kicker: quote?.source === "scrydex" ? "Scrydex" : "TCGplayer",
    value: loading && !variant ? "…" : variant ? money(variant.market, variant.currency) : "No quote",
    detail: variant?.label ?? (loading ? "Checking the feed" : "Open the live page"),
    href: marketHref,
  };

  const euro: CardFact = sales
    ? {
        id: "cardmarket",
        kicker: "Cardmarket",
        value: money(sales.trend ?? sales.avg7, "EUR"),
        detail: sales.avg1 != null ? `Yesterday ${money(sales.avg1, "EUR")}` : sales.avg7 != null ? `7-day ${money(sales.avg7, "EUR")}` : "Trend",
        href: cardmarketHref,
      }
    : graded[0]
      ? {
          id: "graded",
          kicker: "Graded",
          value: money(graded[0].market, graded[0].currency),
          detail: `${graded[0].company} ${graded[0].grade}`,
          href: marketHref,
        }
      : {
          id: "cardmarket",
          kicker: "Cardmarket",
          value: "Search",
          detail: "No euro quote",
          href: cardmarketHref,
        };

  const auctionFact: CardFact = {
    id: "auctions",
    kicker: "Auctions",
    value: auction?.price != null ? money(auction.price, auction.currency) : "Search",
    detail: auction?.bids != null ? `${auction.bids} bids` : "eBay auctions",
    href: auctions.searchUrl || ebaySearchUrl(card, "auction"),
  };

  const binFact: CardFact = {
    id: "bin",
    kicker: "Buy it now",
    value: bin?.price != null ? money(bin.price, bin.currency) : "Search",
    detail: bin ? "Lowest ask" : "eBay Buy It Now",
    href: buyNow.searchUrl || ebaySearchUrl(card, "bin"),
  };

  const salesFact: CardFact = {
    id: "sales",
    kicker: "Recent sales",
    value: sales?.avg7 != null
      ? money(sales.avg7, "EUR")
      : sales?.avg1 != null
        ? money(sales.avg1, "EUR")
        : sales?.trend != null
          ? money(sales.trend, "EUR")
          : week?.percent != null
            ? percent(week.percent)
            : variant
              ? money(variant.market, variant.currency)
              : "Sold",
    detail: sales?.avg7 != null
      ? "7-day average"
      : sales?.avg1 != null
        ? "Yesterday’s average"
        : sales?.trend != null
          ? "Trend price"
          : week
            ? `${week.days}-day move`
            : variant
              ? "TCGplayer market"
              : "Ended recently",
    href: ebaySearchUrl(card, "sold"),
  };

  const community: CardFact = {
    id: "pin",
    kicker: pin.source === "other" ? "Other" : pin.source === "facebook" ? "Facebook" : "Discord",
    value: pin.price.trim() || "Pin",
    detail: pin.note.trim() || "A price you saw",
    href: facebookSearchUrl(card),
  };

  return [raw, euro, auctionFact, binFact, salesFact, community];
}
