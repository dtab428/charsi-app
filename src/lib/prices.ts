import { variantLabel } from "./format";
import type { CardmarketQuote, GradedQuote, PriceQuote, TrendPoint, VariantQuote } from "./types";

type CacheEntry = { at: number; quote: PriceQuote | null };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 15 * 60 * 1000;

const GRADED_COMPANIES = new Set(["PSA", "BGS", "CGC", "SGC", "TAG"]);

function amount(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number) || number <= 0) return null;
  return number;
}

function signed(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown | null> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function trendsFrom(source: unknown): TrendPoint[] {
  const trends = record(source);
  if (!trends) return [];
  const points: TrendPoint[] = [];
  for (const days of [1, 7, 14, 30, 90, 180]) {
    const point = record(trends[`days_${days}`] ?? trends[`days${days}`]);
    if (!point) continue;
    points.push({
      days,
      change: signed(point.price_change ?? point.priceChange),
      percent: typeof (point.percent_change ?? point.percentChange) === "number" ? ((point.percent_change ?? point.percentChange) as number) : null,
    });
  }
  return points;
}

function fromPokemon(card: Record<string, unknown>): PriceQuote | null {
  const tcg = record(card.tcgplayer);
  const market = record(card.cardmarket);
  const prices = record(tcg?.prices);
  const variants: VariantQuote[] = [];
  if (prices) {
    for (const [key, value] of Object.entries(prices)) {
      const quote = record(value);
      if (!quote) continue;
      variants.push({
        key,
        label: variantLabel(key),
        market: amount(quote.market),
        low: amount(quote.low),
        mid: amount(quote.mid),
        high: amount(quote.high),
        currency: "USD",
      });
    }
  }
  const euro = record(market?.prices);
  const cardmarket: CardmarketQuote | null = euro
    ? {
        trend: amount(euro.trendPrice),
        avg7: amount(euro.avg7),
        avg30: amount(euro.avg30),
        low: amount(euro.lowPrice),
        currency: "EUR",
        updatedAt: text(market?.updatedAt),
        url: text(market?.url),
      }
    : null;
  if (variants.length === 0 && !cardmarket) return null;
  return {
    source: "pokemon-tcg",
    updatedAt: text(tcg?.updatedAt),
    productUrl: text(tcg?.url),
    variants,
    cardmarket,
    graded: [],
    trends: [],
  };
}

function fromScrydex(card: Record<string, unknown>): PriceQuote | null {
  const variantsIn = Array.isArray(card.variants) ? card.variants : [];
  const variants: VariantQuote[] = [];
  const graded: GradedQuote[] = [];
  let trends: TrendPoint[] = [];
  for (const entry of variantsIn) {
    const variant = record(entry);
    if (!variant) continue;
    const name = text(variant.name) ?? "raw";
    const prices = Array.isArray(variant.prices) ? variant.prices : [];
    const raw = prices
      .map((price) => record(price))
      .filter((price): price is Record<string, unknown> => Boolean(price))
      .filter((price) => (text(price.type) ?? "raw") === "raw");
    const nearMint = raw.find((price) => (text(price.condition) ?? "NM") === "NM") ?? raw[0];
    if (nearMint) {
      variants.push({
        key: name,
        label: variantLabel(name),
        market: amount(nearMint.market),
        low: amount(nearMint.low),
        mid: amount(nearMint.mid),
        high: amount(nearMint.high),
        currency: text(nearMint.currency) ?? "USD",
      });
      if (trends.length === 0) trends = trendsFrom(nearMint.trends);
    }
    for (const price of prices) {
      const row = record(price);
      if (!row || text(row.type) !== "graded") continue;
      const company = (text(row.company) ?? "").toUpperCase();
      if (!GRADED_COMPANIES.has(company)) continue;
      const grade = text(row.grade);
      if (!grade || !["10", "9.5", "9"].includes(grade)) continue;
      graded.push({
        company,
        grade,
        market: amount(row.market),
        low: amount(row.low),
        high: amount(row.high),
        currency: text(row.currency) ?? "USD",
      });
    }
  }
  graded.sort((a, b) => {
    const company = ["PSA", "BGS", "CGC", "SGC", "TAG"].indexOf(a.company) - ["PSA", "BGS", "CGC", "SGC", "TAG"].indexOf(b.company);
    if (company !== 0) return company;
    return Number(b.grade) - Number(a.grade);
  });
  if (variants.length === 0 && graded.length === 0) return null;
  return {
    source: "scrydex",
    updatedAt: null,
    productUrl: null,
    variants,
    cardmarket: null,
    graded: graded.slice(0, 4),
    trends,
  };
}

function cardsFrom(payload: unknown): Record<string, unknown>[] {
  const root = record(payload);
  const data = root?.data ?? payload;
  if (Array.isArray(data)) return data.map((entry) => record(entry)).filter((entry): entry is Record<string, unknown> => Boolean(entry));
  const one = record(data);
  return one ? [one] : [];
}

async function fromPokemonApi(ids: string[]): Promise<Map<string, PriceQuote | null>> {
  const found = new Map<string, PriceQuote | null>();
  const headers: HeadersInit = {};
  if (process.env.POKEMON_TCG_API_KEY) headers["X-Api-Key"] = process.env.POKEMON_TCG_API_KEY;
  for (const group of chunk(ids, 20)) {
    const query = group.map((id) => `id:${id}`).join(" OR ");
    const payload = await fetchJson(`https://api.pokemontcg.io/v2/cards?pageSize=250&q=${encodeURIComponent(query)}`, { headers });
    for (const card of cardsFrom(payload)) {
      const id = text(card.id);
      if (!id) continue;
      found.set(id, fromPokemon(card));
    }
  }
  return found;
}

async function fromScrydexApi(ids: string[]): Promise<Map<string, PriceQuote | null> | null> {
  const key = process.env.SCRYDEX_API_KEY;
  const team = process.env.SCRYDEX_TEAM_ID;
  if (!key || !team) return null;
  const found = new Map<string, PriceQuote | null>();
  const headers = { "X-Api-Key": key, "X-Team-ID": team };
  for (const group of chunk(ids, 20)) {
    const query = group.map((id) => `id:${id}`).join(" OR ");
    const payload = await fetchJson(
      `https://api.scrydex.com/pokemon/v1/en/cards?include=prices&page_size=100&q=${encodeURIComponent(query)}`,
      { headers },
    );
    if (!payload) return null;
    for (const card of cardsFrom(payload)) {
      const id = text(card.id);
      if (!id) continue;
      found.set(id, fromScrydex(card));
    }
  }
  return found;
}

export async function quotesFor(ids: string[]): Promise<Record<string, PriceQuote | null>> {
  const now = Date.now();
  const missing: string[] = [];
  const result: Record<string, PriceQuote | null> = {};
  for (const id of ids) {
    const hit = cache.get(id);
    if (hit && now - hit.at < TTL_MS) result[id] = hit.quote;
    else missing.push(id);
  }
  if (missing.length === 0) return result;

  const scrydex = await fromScrydexApi(missing);
  const source = scrydex ?? (await fromPokemonApi(missing));
  for (const id of missing) {
    const quote = source.get(id) ?? null;
    cache.set(id, { at: now, quote });
    result[id] = quote;
  }
  return result;
}

export function priceSource(quotes: Record<string, PriceQuote | null>): "scrydex" | "pokemon-tcg" | "none" {
  for (const quote of Object.values(quotes)) {
    if (quote) return quote.source;
  }
  return "none";
}
