import type { ListingLane, PublicCard } from "./types";

// Nintendo Black Star Promos are "Nintendo Promos" on TCGplayer, and the
// number on the card is 039, not the catalog's 39. Searching the catalog
// set name plus the short number returns no products.
function nintendoPromo(card: PublicCard): boolean {
  return card.setId === "np";
}

function printedPromoNumber(card: PublicCard): string {
  return /^\d+$/.test(card.number) ? card.number.padStart(3, "0") : card.number;
}

export function searchPhrase(card: PublicCard): string {
  if (nintendoPromo(card)) return `Pokemon ${card.name} ${printedPromoNumber(card)}`.replace(/\s+/g, " ").trim();
  const number = card.printedTotal ? `${card.number}/${card.printedTotal}` : card.number;
  return `Pokemon ${card.name} ${card.setName} ${number}`.replace(/\s+/g, " ").trim();
}

export type Grading = { company: string; grade: string };

export function finishTerm(variantKey: string | null | undefined): string {
  if (!variantKey) return "";
  if (/reverse/i.test(variantKey)) return "reverse holo";
  if (/holo/i.test(variantKey)) return "holo";
  return "";
}

const EBAY_GRADER: Record<string, string> = {
  PSA: "Professional Sports Authenticator (PSA)",
  BGS: "Beckett Grading Services (BGS)",
  CGC: "Certified Guaranty Company (CGC)",
  SGC: "Sportscard Guaranty Corporation (SGC)",
  TAG: "Technical Authentication & Grading (TAG)",
};

export function ebaySearchUrl(card: PublicCard, lane: "auction" | "bin" | "sold", grading?: Grading | null, finish?: string): string {
  const url = new URL("https://www.ebay.com/sch/183454/i.html");
  const parts = [searchPhrase(card), finish ?? ""];
  url.searchParams.set("_nkw", parts.filter(Boolean).join(" "));
  url.searchParams.set("_sacat", "183454");
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
  const grader = grading ? EBAY_GRADER[grading.company] : undefined;
  if (grading && grader) {
    url.searchParams.set("rt", "nc");
    url.searchParams.set("Graded", "Yes");
    url.searchParams.set("Grade", grading.grade);
  }
  // eBay emits the grader aspect double-encoded (Professional%2520Grader=…).
  // A normal query parameter is ignored, so the graded filter never turns on
  // and raw cards stay in the results. Append it after the other params.
  const aspect = grader ? `&${ebayAspect("Professional Grader", grader)}` : "";
  return affiliateUrl(`${url.toString()}${aspect}`);
}

function ebayForm(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function ebayAspect(name: string, value: string): string {
  return `${ebayForm(ebayForm(name))}=${ebayForm(ebayForm(value))}`;
}

export function tcgplayerSearchUrl(card: PublicCard): string {
  const url = new URL("https://www.tcgplayer.com/search/pokemon/product");
  const query = nintendoPromo(card) ? `${card.name} ${printedPromoNumber(card)}` : `${card.name} ${card.setName} ${card.number}`;
  url.searchParams.set("q", query.replace(/\s+/g, " ").trim());
  url.searchParams.set("view", "grid");
  return affiliateUrl(url.toString());
}

const TCG_PRINTING: Record<string, string> = {
  normal: "Normal",
  holofoil: "Holofoil",
  reverseHolofoil: "Reverse Holofoil",
  "1stEdition": "1st Edition",
  "1stEditionNormal": "1st Edition",
  "1stEditionHolofoil": "1st Edition Holofoil",
  unlimited: "Unlimited",
  unlimitedNormal: "Unlimited",
  unlimitedHolofoil: "Unlimited Holofoil",
};

// A product page with no printing or condition selected mixes every copy.
// Raw links open that printing in Near Mint, which is the condition the price is being compared with.
export function tcgplayerProductUrl(href: string, variantKey: string | null | undefined): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  if (!url.hostname.replace(/^www\./, "").endsWith("tcgplayer.com") || !url.pathname.includes("/product/")) return href;
  const printing = variantKey ? TCG_PRINTING[variantKey] : undefined;
  if (printing) url.searchParams.set("Printing", printing);
  url.searchParams.set("page", "1");
  url.searchParams.set("Condition", "Near Mint");
  return url.toString();
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
  const images = new Set(["images.pokemontcg.io", "images.scrydex.com", "tcgplayer-cdn.tcgplayer.com", "assets.tcgdex.net", "card-images.fetchtcg.com"]);
  if (!images.has(url.hostname)) return false;
  if (url.pathname.includes("..") || url.pathname.includes("\\")) return false;
  return true;
}
