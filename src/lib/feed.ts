import { pickVariant, saleAverages } from "./facts";
import { endsLabel, listedLabel, money, quoteDate } from "./format";
import { affiliateUrl, altSearchUrl, cardmarketSearchUrl, fanaticsSearchUrl, ebaySearchUrl, facebookSearchUrl, goldinSearchUrl, httpsHref, tcgplayerSearchUrl, type Grading } from "./links";
import type { Listing, ListingLane, Pin, PriceQuote, PublicCard } from "./types";

export type SourceFilter = "all" | "tcgplayer" | "cardmarket" | "ebay";
export type Company = "PSA" | "BGS" | "CGC" | "TAG" | "SGC";
export type Condition = "raw" | Company;
export type Filters = { source: SourceFilter; condition: Condition; grade: string };

export const COMPANIES: Company[] = ["PSA", "BGS", "CGC", "TAG", "SGC"];
export const GRADES: Record<Company, string[]> = {
  PSA: ["10", "9", "8", "7"],
  BGS: ["10", "9.5", "9", "8.5", "8", "7.5", "7"],
  CGC: ["10", "9.5", "9", "8.5", "8", "7.5", "7"],
  TAG: ["10", "9.5", "9", "8.5", "8", "7.5", "7"],
  SGC: ["10", "9.5", "9", "8.5", "8", "7.5", "7"],
};
export const DEFAULT_FILTERS: Filters = { source: "all", condition: "raw", grade: "10" };

export type FeedSource = "tcgplayer" | "cardmarket" | "ebay" | "scrydex" | "pin";

export type FeedRow = {
  id: string;
  source: FeedSource;
  badge?: string;
  label: string;
  sub: string | null;
  value: string;
  when: string | null;
  href: string | null;
  link: boolean;
  at: number;
  order: number;
};

export type Feed = {
  ended: FeedRow[];
  live: FeedRow[];
  more: FeedRow[];
  notice: string | null;
  empty: string | null;
};

const TOP = Number.MAX_SAFE_INTEGER;

function allowed(filter: SourceFilter, source: FeedSource): boolean {
  if (filter === "all") return true;
  if (filter === "tcgplayer") return source === "tcgplayer" || source === "scrydex";
  if (filter === "cardmarket") return source === "cardmarket";
  return source === "ebay";
}

function stamp(value: string | null | undefined): number {
  if (!value) return 0;
  const time = Date.parse(value.replace(/\//g, "-"));
  return Number.isNaN(time) ? 0 : time;
}

function time(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function listingRow(listing: Listing, kind: "auction" | "bin", index: number): FeedRow {
  const parts =
    kind === "auction"
      ? [listing.bids != null ? `${listing.bids} ${listing.bids === 1 ? "bid" : "bids"}` : null, listing.shipping, listing.condition]
      : [listing.shipping, listing.condition];
  return {
    id: `${kind}-${listing.url}`,
    source: "ebay",
    label: listing.title,
    sub: parts.filter(Boolean).join(" · ") || null,
    value: money(listing.price, listing.currency),
    when: kind === "auction" ? endsLabel(listing.endsAt) : listedLabel(listing.listedAt),
    href: affiliateUrl(listing.url),
    link: false,
    at: kind === "auction" ? time(listing.endsAt) : time(listing.listedAt),
    order: index,
  };
}

function laneLinkRow(card: PublicCard, lane: ListingLane, kind: "auction" | "bin", grading: Grading | null, order: number): FeedRow {
  const graded = grading ? ` · ${grading.company} ${grading.grade}` : "";
  let sub = kind === "auction" ? "Ending soonest first" : "Newest listings first";
  if (!grading) {
    if (lane.status === "unconfigured") sub += ". Live listings appear here once an eBay key is connected.";
    else if (lane.status === "empty") sub = "No live listings right now. Open eBay to check.";
    else if (lane.status === "error") sub = lane.notice ?? "eBay didn’t answer. Open eBay instead.";
  }
  return {
    id: `${kind}-link${graded}`,
    source: "ebay",
    label: kind === "auction" ? `Auctions${graded}` : `Buy It Now${graded}`,
    sub,
    value: "Open eBay",
    when: null,
    href: grading ? ebaySearchUrl(card, kind, grading) : lane.searchUrl || ebaySearchUrl(card, kind),
    link: true,
    at: 0,
    order,
  };
}

export function buildFeed(input: {
  card: PublicCard;
  modifiers: string[];
  quote: PriceQuote | null | undefined;
  variantKey: string | null;
  auctions: ListingLane;
  buyNow: ListingLane;
  pin: Pin;
  filters: Filters;
}): Feed {
  const { card, modifiers, quote, variantKey, auctions, buyNow, pin, filters } = input;
  const ended: FeedRow[] = [];
  const live: FeedRow[] = [];
  const more: FeedRow[] = [];
  let notice: string | null = null;
  const keep = (source: FeedSource) => allowed(filters.source, source);

  if (filters.condition === "raw") {
    const variant = quote?.variants.find((entry) => entry.key === variantKey) ?? pickVariant(modifiers, quote?.variants ?? []);
    const marketSource: FeedSource = quote?.source === "scrydex" ? "scrydex" : "tcgplayer";
    const marketHref = affiliateUrl(httpsHref(variant?.productUrl ?? quote?.productUrl, tcgplayerSearchUrl(card)));
    const cardmarketHref = httpsHref(quote?.cardmarket?.url, cardmarketSearchUrl(card));
    const sales = saleAverages(quote, variant);

    if (keep("ebay")) {
      ended.push({
        id: "ebay-sold",
        source: "ebay",
        label: "Sold on eBay",
        sub: "Ended recently, newest first",
        value: "Open eBay",
        when: null,
        href: ebaySearchUrl(card, "sold"),
        link: true,
        at: TOP,
        order: 0,
      });
    }

    if (variant && keep(marketSource)) {
      const stamped = quoteDate(quote?.updatedAt);
      ended.push({
        id: "market",
        source: marketSource,
        label: "Market price",
        sub: `${variant.label} · based on recent sales`,
        value: money(variant.market, variant.currency),
        when: stamped ? `Updated ${stamped}` : null,
        href: marketHref,
        link: false,
        at: stamp(quote?.updatedAt),
        order: 0,
      });
      if (variant.low != null || variant.mid != null || variant.high != null) {
        more.push({
          id: "range",
          source: marketSource,
          label: "Price range",
          sub: `${variant.label} · Mid ${money(variant.mid, variant.currency)}`,
          value: `${money(variant.low, variant.currency)} – ${money(variant.high, variant.currency)}`,
          when: null,
          href: marketHref,
          link: false,
          at: 0,
          order: 0,
        });
      }
    } else if (!variant && keep("tcgplayer")) {
      ended.push({
        id: "market-missing",
        source: "tcgplayer",
        label: "TCGplayer",
        sub: quote === null ? "No quote came back for this card" : "Open the live page",
        value: "Open",
        when: null,
        href: marketHref,
        link: true,
        at: 0,
        order: 9,
      });
    }

    if (keep("cardmarket")) {
      if (sales) {
        const stamped = quoteDate(quote?.cardmarket?.updatedAt);
        const when = stamped ? `As of ${stamped}` : null;
        const at = stamp(quote?.cardmarket?.updatedAt);
        const periods: [number | null, string][] = [
          [sales.avg1, "Yesterday"],
          [sales.avg7, "7-day average"],
          [sales.avg30, "30-day average"],
        ];
        periods.forEach(([value, label], index) => {
          if (value == null) return;
          ended.push({
            id: `cardmarket-${index}`,
            source: "cardmarket",
            label: "Sold average",
            sub: label,
            value: money(value, "EUR"),
            when,
            href: cardmarketHref,
            link: false,
            at,
            order: index + 1,
          });
        });
        if (sales.trend != null) {
          more.push({ id: "trend", source: "cardmarket", label: "Trend price", sub: null, value: money(sales.trend, "EUR"), when: null, href: cardmarketHref, link: false, at: 0, order: 1 });
        }
        if (sales.low != null) {
          more.push({ id: "low", source: "cardmarket", label: "Lowest listing", sub: null, value: money(sales.low, "EUR"), when: null, href: cardmarketHref, link: false, at: 0, order: 2 });
        }
      } else {
        ended.push({
          id: "cardmarket-missing",
          source: "cardmarket",
          label: "Cardmarket",
          sub: "No euro sale average for this card",
          value: "Open",
          when: null,
          href: cardmarketHref,
          link: true,
          at: 0,
          order: 9,
        });
      }
    }

    if (keep("ebay")) {
      const auctionRows = auctions.status === "live" ? auctions.listings.map((listing, index) => listingRow(listing, "auction", index)).sort((a, b) => a.at - b.at) : [];
      const binRows = buyNow.status === "live" ? buyNow.listings.map((listing, index) => listingRow(listing, "bin", index)).sort((a, b) => b.at - a.at) : [];
      live.push(...(auctionRows.length > 0 ? auctionRows : [laneLinkRow(card, auctions, "auction", null, 0)]));
      live.push(...(binRows.length > 0 ? binRows : [laneLinkRow(card, buyNow, "bin", null, 1)]));
    }

    if (filters.source === "all") {
      if (pin.price.trim()) {
        const label = pin.source === "facebook" ? "Facebook" : pin.source === "discord" ? "Discord" : "Pinned";
        live.push({ id: "pin", source: "pin", badge: label, label: pin.note.trim() || "A price you saw", sub: "Pinned by you", value: pin.price.trim(), when: null, href: null, link: false, at: 0, order: 9 });
      }
      more.push({ id: "facebook", source: "pin", badge: "Facebook", label: "Marketplace search", sub: "Opens Facebook. Not scanned.", value: "Open", when: null, href: facebookSearchUrl(card), link: true, at: 0, order: 8 });
      more.push({ id: "goldin", source: "pin", badge: "Goldin", label: "Goldin search", sub: "Auction house results", value: "Open", when: null, href: goldinSearchUrl(card), link: true, at: 0, order: 9 });
      more.push({ id: "fanatics", source: "pin", badge: "Fanatics", label: "Fanatics Collect search", sub: "Opens a web search of their site. Not scanned.", value: "Open", when: null, href: fanaticsSearchUrl(card), link: true, at: 0, order: 10 });
      more.push({ id: "alt", source: "pin", badge: "ALT", label: "ALT search", sub: "Opens a web search of their site. Not scanned.", value: "Open", when: null, href: altSearchUrl(card), link: true, at: 0, order: 11 });
    }
  } else {
    const grading: Grading = { company: filters.condition, grade: filters.grade };
    const hits = (quote?.graded ?? []).filter((entry) => entry.company === grading.company && entry.grade === grading.grade);
    if (filters.source === "all") {
      hits.forEach((entry, index) => {
        ended.push({
          id: `graded-${entry.company}-${entry.grade}-${index}`,
          source: "scrydex",
          label: `${entry.company} ${entry.grade}`,
          sub: `Low ${money(entry.low, entry.currency)} · High ${money(entry.high, entry.currency)}`,
          value: money(entry.market, entry.currency),
          when: null,
          href: null,
          link: false,
          at: TOP - 1,
          order: index,
        });
      });
    }
    if (keep("ebay")) {
      ended.push({
        id: "ebay-sold-graded",
        source: "ebay",
        label: `Sold on eBay · ${grading.company} ${grading.grade}`,
        sub: "Ended recently, newest first",
        value: "Open eBay",
        when: null,
        href: ebaySearchUrl(card, "sold", grading),
        link: true,
        at: TOP,
        order: 0,
      });
      live.push(laneLinkRow(card, auctions, "auction", grading, 0));
      live.push(laneLinkRow(card, buyNow, "bin", grading, 1));
    }
    if (hits.length === 0) {
      notice = `No ${grading.company} ${grading.grade} price in the free feeds. TCGplayer and Cardmarket don’t publish graded prices here, so graded numbers need a paid feed such as Scrydex. These links open the eBay results for that grade.`;
    }
  }

  ended.sort((a, b) => b.at - a.at || a.order - b.order);
  more.sort((a, b) => a.order - b.order);

  const empty = ended.length + live.length === 0 ? "Nothing from this source for this view. Try All sources." : null;
  return { ended, live, more, notice, empty };
}
