import type { ListingLane, PublicCard } from "./types";

export function searchPhrase(card: PublicCard): string {
  const number = card.printedTotal ? `${card.number}/${card.printedTotal}` : card.number;
  return `Pokemon ${card.name} ${card.setName} ${number}`.replace(/\s+/g, " ").trim();
}

export function ebaySearchUrl(card: PublicCard, lane: "auction" | "bin" | "sold"): string {
  const url = new URL("https://www.ebay.com/sch/183454/i.html");
  url.searchParams.set("_nkw", searchPhrase(card));
  if (lane === "auction") url.searchParams.set("LH_Auction", "1");
  if (lane === "bin") url.searchParams.set("LH_BIN", "1");
  if (lane === "sold") {
    url.searchParams.set("LH_Sold", "1");
    url.searchParams.set("LH_Complete", "1");
  }
  return url.toString();
}

export function tcgplayerSearchUrl(card: PublicCard): string {
  const url = new URL("https://www.tcgplayer.com/search/pokemon/product");
  url.searchParams.set("q", `${card.name} ${card.setName} ${card.number}`);
  url.searchParams.set("view", "grid");
  return url.toString();
}

export function cardmarketSearchUrl(card: PublicCard): string {
  const url = new URL("https://www.cardmarket.com/en/Pokemon/Products/Search");
  url.searchParams.set("searchString", `${card.name} ${card.setName}`);
  return url.toString();
}

export function goldinSearchUrl(card: PublicCard): string {
  const url = new URL("https://goldin.co/search");
  url.searchParams.set("q", searchPhrase(card));
  return url.toString();
}

export function facebookSearchUrl(card: PublicCard): string {
  const url = new URL("https://www.facebook.com/marketplace/search/");
  url.searchParams.set("query", searchPhrase(card));
  return url.toString();
}

export function emptyLane(card: PublicCard, lane: "auction" | "bin"): ListingLane {
  return {
    status: "unconfigured",
    listings: [],
    searchUrl: ebaySearchUrl(card, lane),
    notice: null,
  };
}

export function httpsHref(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

export function allowedImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.hostname !== "images.pokemontcg.io" && url.hostname !== "images.scrydex.com") return false;
  if (url.pathname.includes("..") || url.pathname.includes("\\")) return false;
  return true;
}
