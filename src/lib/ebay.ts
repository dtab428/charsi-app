import { ebaySearchUrl } from "./links";
import type { Listing, ListingLane, PublicCard } from "./types";

type Token = { value: string; expires: number };
let token: Token | null = null;
const cache = new Map<string, { at: number; lane: ListingLane }>();
const TTL_MS = 8 * 60 * 1000;

export function ebayConfigured(): boolean {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

function lane(card: PublicCard, kind: "auction" | "bin", status: ListingLane["status"], listings: Listing[], notice: string | null): ListingLane {
  return { status, listings, searchUrl: ebaySearchUrl(card, kind), notice };
}

function safeEbayUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.hostname !== "www.ebay.com" && url.hostname !== "ebay.com") return null;
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
    const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
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
    const price = item.price && typeof item.price === "object" ? (item.price as { value?: unknown; currency?: unknown }) : null;
    const shipping = Array.isArray(item.shippingOptions) ? (item.shippingOptions[0] as { shippingCost?: { value?: unknown } } | undefined) : undefined;
    const shipValue = numberOrNull(shipping?.shippingCost?.value);
    listings.push({
      title,
      url,
      price: numberOrNull(price?.value),
      currency: typeof price?.currency === "string" ? price.currency : "USD",
      bids: numberOrNull(item.bidCount),
      endsAt: typeof item.itemEndDate === "string" ? item.itemEndDate : null,
      shipping: shipValue == null ? null : shipValue === 0 ? "Free shipping" : `+${shipValue.toFixed(2)} shipping`,
      condition: typeof item.condition === "string" ? item.condition : null,
    });
    if (listings.length === 3) break;
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
  const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
  url.searchParams.set("q", `Pokemon ${card.name} ${card.setName} ${card.number}`.replace(/\s+/g, " "));
  url.searchParams.set("category_ids", "183454");
  url.searchParams.set("limit", "4");
  url.searchParams.set("filter", `buyingOptions:{${kind === "auction" ? "AUCTION" : "FIXED_PRICE"}}`);
  url.searchParams.set("sort", kind === "auction" ? "endingSoonest" : "price");
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
    const result = lane(card, kind, listings.length ? "live" : "empty", listings, null);
    cache.set(key, { at: Date.now(), lane: result });
    return result;
  } catch {
    return lane(card, kind, "error", [], "eBay didn’t answer in time.");
  }
}

export async function marketFor(cards: PublicCard[]): Promise<{
  configured: boolean;
  results: { id: string; auctions: ListingLane; buyNow: ListingLane }[];
}> {
  if (!ebayConfigured()) {
    return {
      configured: false,
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
  return { configured: true, results };
}
