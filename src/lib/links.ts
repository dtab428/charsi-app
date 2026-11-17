import type { ListingLane, PublicCard } from "./types";

export function searchPhrase(card: PublicCard): string {
  const number = card.printedTotal ? `${card.number}/${card.printedTotal}` : card.number;
  return `Pokemon ${card.name} ${card.setName} ${number}`.replace(/\s+/g, " ").trim();
}

export type Grading = { company: string; grade: string };

export function ebaySearchUrl(card: PublicCard, lane: "auction" | "bin" | "sold", grading?: Grading | null): string {
  const url = new URL("https://www.ebay.com/sch/183454/i.html");
  const phrase = grading ? `${searchPhrase(card)} ${grading.company} ${grading.grade}` : searchPhrase(card);
  url.searchParams.set("_nkw", phrase);
  if (lane === "auction") {
    url.searchParams.set("LH_Auction", "1");
    url.searchParams.set("_sop", "1");
  }
  if (lane === "bin") {
    url.searchParams.set("LH_BIN", "1");
    url.searchParams.set("_sop", "10");
  }
  if (lane === "sold") {
    url.searchParams.set("LH_Sold", "1");
    url.searchParams.set("LH_Complete", "1");
    url.searchParams.set("_sop", "13");
  }
  return affiliateUrl(url.toString());
}

export function tcgplayerSearchUrl(card: PublicCard): string {
  const url = new URL("https://www.tcgplayer.com/search/pokemon/product");
  url.searchParams.set("q", `${card.name} ${card.setName} ${card.number}`);
  url.searchParams.set("view", "grid");
  return affiliateUrl(url.toString());
}

export function affiliateUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host.endsWith("ebay.com")) return ebayAffiliate(url);
  if (host === "tcgplayer.com") return tcgplayerAffiliate(url);
  return value;
}

function ebayAffiliate(url: URL): string {
  const campaign = process.env.NEXT_PUBLIC_EBAY_CAMPAIGN_ID?.trim() ?? "";
  if (!/^\d{4,16}$/.test(campaign) || url.searchParams.has("campid")) return url.toString();
  url.searchParams.set("mkevt", "1");
  url.searchParams.set("mkcid", "1");
  url.searchParams.set("mkrid", "711-53200-19255-0");
  url.searchParams.set("campid", campaign);
  url.searchParams.set("toolid", "10001");
  return url.toString();
}

function tcgplayerAffiliate(url: URL): string {
  const base = process.env.NEXT_PUBLIC_TCGPLAYER_PARTNER_LINK?.trim() ?? "";
  if (!base.startsWith("https://partner.tcgplayer.com/")) return url.toString();
  const wrapped = new URL(base);
  wrapped.searchParams.set("u", url.toString());
  return wrapped.toString();
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

function siteSearchUrl(site: string, card: PublicCard): string {
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", `site:${site} ${searchPhrase(card)}`);
  return url.toString();
}

export function fanaticsSearchUrl(card: PublicCard): string {
  return siteSearchUrl("fanaticscollect.com", card);
}

export function altSearchUrl(card: PublicCard): string {
  return siteSearchUrl("alt.xyz", card);
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
  const images = new Set(["images.pokemontcg.io", "images.scrydex.com", "tcgplayer-cdn.tcgplayer.com", "assets.tcgdex.net"]);
  if (!images.has(url.hostname)) return false;
  if (url.pathname.includes("..") || url.pathname.includes("\\")) return false;
  return true;
}
