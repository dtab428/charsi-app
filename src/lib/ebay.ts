import { editionOf, finishOf } from "./format";
import { editionClause, finishClause, listingMatchesGrade, listingMatchesNumber, listingMatchesPrinting, listingMatchesWear, type GradeAsk } from "./listing-match";
import { ebaySearchUrl } from "./links";
import type { Wear } from "./wear";
import type { Listing, ListingLane, PublicCard } from "./types";

export type ListingScope = {
  printing?: string | null;
  grade?: GradeAsk | "raw" | null;
  wear?: Wear | null;
};

type Token = { value: string; expires: number };
let token: Token | null = null;
const cache = new Map<string, { at: number; lane: ListingLane }>();
const TTL_MS = 8 * 60 * 1000;

export function ebayConfigured(): boolean {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

function ebaySandbox(): boolean {
  const asked = process.env.EBAY_ENV?.trim().toLowerCase();
  if (asked === "sandbox") return true;
  if (asked === "production") return false;
  const id = process.env.EBAY_CLIENT_ID ?? "";
  const secret = process.env.EBAY_CLIENT_SECRET ?? "";
  return id.includes("-SBX-") || secret.startsWith("SBX-");
}

function ebayApi(): string {
  return ebaySandbox() ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

const SHOWN = 24;

function lane(card: PublicCard, kind: "auction" | "bin", status: ListingLane["status"], listings: Listing[], notice: string | null, scope: ListingScope = {}): ListingLane {
  const printing = scope.printing;
  const grading = scope.grade && scope.grade !== "raw" ? scope.grade : null;
  const finish = finishOf(printing) === "reverse" ? "reverse holo" : finishOf(printing) === "holo" ? "holo" : "";
  return { status, listings, searchUrl: ebaySearchUrl(card, kind, grading, finish, scope.wear ?? null, editionOf(printing)), notice };
}

function setTerm(name: string): string {
  const trimmed = name.replace(/\s+base\s+set$/i, "").replace(/\s+(set|series)$/i, "").trim();
  return trimmed || name;
}

function searchQuery(card: PublicCard, scope: ListingScope): string {
  const name = card.name.normalize("NFKD").replace(/[^\u0000-\u007F]/g, " ").replace(/\s+/g, " ").trim();
  const digits = card.number.trim().replace(/^0+(?=\d)/, "");
  const number = card.printedTotal && /^\d+$/.test(digits) ? `(${digits}/${card.printedTotal}, #${digits})` : card.number;
  const grade = scope.grade && scope.grade !== "raw" ? `${scope.grade.company} ${scope.grade.grade}` : scope.grade === "raw" ? "-PSA -BGS -CGC -SGC -TAG -graded" : "";
  return ["Pokemon", name, setTerm(card.setName), number, finishClause(finishOf(scope.printing)), editionClause(editionOf(scope.printing)), grade]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeEbayUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const hosts = ebaySandbox() ? ["www.ebay.com", "ebay.com", "www.sandbox.ebay.com", "sandbox.ebay.com"] : ["www.ebay.com", "ebay.com"];
    if (!hosts.includes(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function appToken(): Promise<string | null> {
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (token && token.expires > Date.now() + 30_000) return token.value;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "https://api.ebay.com/oauth/api_scope",
  });
  try {
    const response = await fetch(`${ebayApi()}/identity/v1/oauth2/token`, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!payload.access_token) return null;
    token = { value: payload.access_token, expires: Date.now() + (payload.expires_in ?? 3600) * 1000 };
    return token.value;
  } catch {
    return null;
  }
}

function numberOrNull(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

type MoneyField = { value?: unknown; currency?: unknown };

function moneyField(value: unknown): { amount: number | null; currency: string | null } {
  if (!value || typeof value !== "object") return { amount: null, currency: null };
  const field = value as MoneyField;
  return {
    amount: numberOrNull(field.value),
    currency: typeof field.currency === "string" ? field.currency : null,
  };
}

// Fixed-price listings carry `price`. Auctions leave `price` empty and put
// the current bid in `currentBidPrice`, including a starting bid with 0 bids.
export function listingAmount(item: { price?: unknown; currentBidPrice?: unknown }): { amount: number | null; currency: string } {
  const ask = moneyField(item.price);
  const bid = moneyField(item.currentBidPrice);
  const chosen = ask.amount != null ? ask : bid;
  return { amount: chosen.amount, currency: chosen.currency ?? "USD" };
}

function listingsFrom(payload: unknown, card: PublicCard, scope: ListingScope): Listing[] {
  const root = payload && typeof payload === "object" ? (payload as { itemSummaries?: unknown }) : null;
  if (!root || !Array.isArray(root.itemSummaries)) return [];
  const listings: Listing[] = [];
  const grade = scope.grade ?? null;
  const wear = scope.wear ?? null;
  for (const entry of root.itemSummaries) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const url = safeEbayUrl(item.itemWebUrl);
    const title = typeof item.title === "string" ? item.title.slice(0, 140) : "";
    if (!url || !title) continue;
    const amount = listingAmount(item);
    const thumb = item.thumbnailImages && Array.isArray(item.thumbnailImages) ? (item.thumbnailImages[0] as { imageUrl?: unknown } | undefined) : undefined;
    const picture = item.image && typeof item.image === "object" ? (item.image as { imageUrl?: unknown }).imageUrl : thumb?.imageUrl;
    const image = typeof picture === "string" && /^https:\/\/i\.ebayimg\.com\//.test(picture) ? picture : null;
    if (/\b(lot|bundle|collection|bulk)\b/i.test(title)) continue;
    if (/\b(japanese|japan|italian|german|french|korean|chinese|spanish)\b/i.test(title) && !/\benglish\b/i.test(title)) continue;
    if (!listingMatchesNumber(title, card.number, card.printedTotal)) continue;
    if (!listingMatchesPrinting(title, scope.printing)) continue;
    if (!listingMatchesGrade(title, grade)) continue;
    if (!listingMatchesWear(title, wear)) continue;
    const shipping = Array.isArray(item.shippingOptions) ? (item.shippingOptions[0] as { shippingCost?: { value?: unknown } } | undefined) : undefined;
    const shipValue = numberOrNull(shipping?.shippingCost?.value);
    listings.push({
      title,
      url,
      image,
      price: amount.amount,
      currency: amount.currency,
      bids: numberOrNull(item.bidCount),
      endsAt: typeof item.itemEndDate === "string" ? item.itemEndDate : null,
      listedAt: typeof item.itemCreationDate === "string" ? item.itemCreationDate : null,
      shipping: shipValue == null ? null : shipValue === 0 ? "Free shipping" : `+${shipValue.toFixed(2)} shipping`,
      condition: typeof item.condition === "string" ? item.condition : null,
    });
    if (listings.length === SHOWN) break;
  }
  return listings;
}

function scopeKey(scope: ListingScope): string {
  const grade = !scope.grade ? "all" : scope.grade === "raw" ? "raw" : `${scope.grade.company}${scope.grade.grade}`;
  return `${scope.printing ?? ""}:${grade}:${scope.wear ?? ""}`;
}

async function search(card: PublicCard, kind: "auction" | "bin", scope: ListingScope = {}): Promise<ListingLane> {
  const key = `${kind}:${card.id}:${scopeKey(scope)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.lane;
  const access = await appToken();
  if (!access) {
    return lane(card, kind, "error", [], "eBay didn’t accept the application key.", scope);
  }
  const url = new URL(`${ebayApi()}/buy/browse/v1/item_summary/search`);
  url.searchParams.set("q", searchQuery(card, scope));
  url.searchParams.set("category_ids", "183454");
  url.searchParams.set("limit", "100");
  url.searchParams.set("filter", `buyingOptions:{${kind === "auction" ? "AUCTION" : "FIXED_PRICE"}}`);
  url.searchParams.set("sort", kind === "auction" ? "endingSoonest" : "newlyListed");
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: {
        authorization: `Bearer ${access}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
    });
    if (!response.ok) {
      return lane(card, kind, "error", [], "eBay didn’t return listings.", scope);
    }
    const listings = listingsFrom(await response.json(), card, scope);
    const notice = listings.length || !ebaySandbox() ? null : "Sandbox key connected. eBay’s test site has no live Pokémon listings.";
    const result = lane(card, kind, listings.length ? "live" : "empty", listings, notice, scope);
    cache.set(key, { at: Date.now(), lane: result });
    return result;
  } catch {
    return lane(card, kind, "error", [], "eBay didn’t answer in time.", scope);
  }
}

export async function marketFor(cards: { card: PublicCard; printing?: string | null; grade?: GradeAsk | "raw" | null; wear?: Wear | null }[]): Promise<{
  configured: boolean;
  sandbox: boolean;
  results: { id: string; printing: string | null; auctions: ListingLane; buyNow: ListingLane }[];
}> {
  if (!ebayConfigured()) {
    return {
      configured: false,
      sandbox: false,
      results: cards.map((entry) => ({
        id: entry.card.id,
        printing: entry.printing ?? null,
        auctions: lane(entry.card, "auction", "unconfigured", [], null, entry),
        buyNow: lane(entry.card, "bin", "unconfigured", [], null, entry),
      })),
    };
  }
  const results: { id: string; printing: string | null; auctions: ListingLane; buyNow: ListingLane }[] = [];
  const queue = [...cards];
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) return;
      const scope: ListingScope = { printing: next.printing ?? null, grade: next.grade ?? null, wear: next.wear ?? null };
      const [auctions, buyNow] = await Promise.all([search(next.card, "auction", scope), search(next.card, "bin", scope)]);
      results.push({ id: next.card.id, printing: scope.printing ?? null, auctions, buyNow });
    }
  });
  await Promise.all(workers);
  return { configured: true, sandbox: ebaySandbox(), results };
}
