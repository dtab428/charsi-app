import { ebaySearchUrl } from "./links";
import type { Listing, ListingLane, PublicCard } from "./types";

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

function lane(card: PublicCard, kind: "auction" | "bin", status: ListingLane["status"], listings: Listing[], notice: string | null): ListingLane {
  return { status, listings, searchUrl: ebaySearchUrl(card, kind), notice };
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

function listingsFrom(payload: unknown): Listing[] {
  const root = payload && typeof payload === "object" ? (payload as { itemSummaries?: unknown }) : null;
  if (!root || !Array.isArray(root.itemSummaries)) return [];
  const listings: Listing[] = [];
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
    if (listings.length === 8) break;
  }
  return listings;
}

async function search(card: PublicCard, kind: "auction" | "bin"): Promise<ListingLane> {
  const key = `${kind}:${card.id}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.lane;
  const access = await appToken();
  if (!access) {
    return lane(card, kind, "error", [], "eBay didn’t accept the application key.");
  }
  const url = new URL(`${ebayApi()}/buy/browse/v1/item_summary/search`);
  const number = card.printedTotal ? `${card.number}/${card.printedTotal}` : card.number;
  url.searchParams.set("q", `Pokemon ${card.name} ${number}`.replace(/\s+/g, " "));
  url.searchParams.set("category_ids", "183454");
  url.searchParams.set("limit", "10");
  url.searchParams.set("filter", `buyingOptions:{${kind === "auction" ? "AUCTION" : "FIXED_PRICE"}}`);
  url.searchParams.set("sort", kind === "auction" ? "endingSoonest" : "newlyListed");
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        authorization: `Bearer ${access}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
    });
    if (!response.ok) {
      const failed = lane(card, kind, "error", [], "eBay didn’t return listings.");
      return failed;
    }
    const listings = listingsFrom(await response.json());
    const notice = listings.length || !ebaySandbox() ? null : "Sandbox key connected. eBay’s test site has no live Pokémon listings.";
    const result = lane(card, kind, listings.length ? "live" : "empty", listings, notice);
    cache.set(key, { at: Date.now(), lane: result });
    return result;
  } catch {
    return lane(card, kind, "error", [], "eBay didn’t answer in time.");
  }
}

export async function marketFor(cards: PublicCard[]): Promise<{
  configured: boolean;
  sandbox: boolean;
  results: { id: string; auctions: ListingLane; buyNow: ListingLane }[];
}> {
  if (!ebayConfigured()) {
    return {
      configured: false,
      sandbox: false,
      results: cards.map((card) => ({
        id: card.id,
        auctions: lane(card, "auction", "unconfigured", [], null),
        buyNow: lane(card, "bin", "unconfigured", [], null),
      })),
    };
  }
  const results: { id: string; auctions: ListingLane; buyNow: ListingLane }[] = [];
  const queue = [...cards];
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length > 0) {
      const card = queue.shift();
      if (!card) return;
      const [auctions, buyNow] = await Promise.all([search(card, "auction"), search(card, "bin")]);
      results.push({ id: card.id, auctions, buyNow });
    }
  });
  await Promise.all(workers);
  return { configured: true, sandbox: ebaySandbox(), results };
}
