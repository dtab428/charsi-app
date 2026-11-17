import { getCatalog } from "./catalog";
import { variantLabel } from "./format";
import { recordSnapshots } from "./history";
import type { CardmarketQuote, EuroSales, GradedQuote, PriceQuote, TrendPoint, VariantQuote } from "./types";

type CacheEntry = { at: number; quote: PriceQuote | null };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 15 * 60 * 1000;
const MISS_TTL_MS = 20 * 1000;

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
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
      if (response.ok) return await response.json();
    } catch {
      // The public price feed blips. One more try, then the card keeps its links.
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
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
        avg1: null,
        avg7: amount(euro.avg7),
        avg30: amount(euro.avg30),
        low: amount(euro.lowPrice),
        currency: "EUR",
        updatedAt: text(market?.updatedAt),
        url: text(market?.url),
        holo: null,
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
      if (!grade || !["10", "9.5", "9", "8"].includes(grade)) continue;
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
    graded: graded.slice(0, 40),
    trends,
  };
}

function euroSales(source: Record<string, unknown>, suffix: "" | "-holo"): EuroSales {
  const read = (name: string) => amount(source[suffix ? `${name}${suffix}` : name]);
  return { trend: read("trend"), avg1: read("avg1"), avg7: read("avg7"), avg30: read("avg30"), low: read("low") };
}

function hasSale(sales: EuroSales): boolean {
  return sales.trend != null || sales.avg1 != null || sales.avg7 != null || sales.avg30 != null || sales.low != null;
}

function collectorKey(number: string, printed: number): string | null {
  const bare = /^0*(\d+)$/.exec(number);
  if (!bare || printed <= 0) return null;
  return `${Number(bare[1])}/${printed}`;
}

function productNumberKey(value: string | undefined): string | null {
  const match = /(\d+)\s*\/\s*(\d+)/.exec(value ?? "");
  if (!match) return null;
  return `${Number(match[1])}/${Number(match[2])}`;
}

function tcgplayerImage(productId: number): string {
  return `https://tcgplayer-cdn.tcgplayer.com/product/${productId}_200w.jpg`;
}

async function holoSibling(cardId: string): Promise<VariantQuote | null> {
  const catalog = getCatalog();
  const card = catalog.cards.find((entry) => entry.id === cardId);
  const set = card ? catalog.sets.get(card.set) : undefined;
  if (!card || !set) return null;
  const wanted = collectorKey(card.num, set.printed);
  if (!wanted) return null;
  const payload = await fetchJson(
    `https://mp-search-api.tcgplayer.com/v1/search/request?q=${encodeURIComponent(`${card.name} ${card.num}/${set.printed}`)}&isList=false`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        algorithm: "sales_synonym_v2",
        from: 0,
        size: 12,
        filters: { term: { productLineName: ["pokemon"] }, match: {} },
        listingSearch: { filters: { term: {}, range: {}, match: {} } },
        context: { cart: {}, shippingCountry: "US" },
        settings: { useFuzzySearch: true },
        sort: {},
      }),
    },
  );
  const results = record(payload)?.results;
  const rows = Array.isArray(results) && record(results[0]) && Array.isArray(record(results[0])?.results) ? (record(results[0])?.results as unknown[]) : [];
  const name = card.name.toLowerCase();
  const setName = set.name.toLowerCase();
  const hits = rows.flatMap((row) => {
    const product = record(row);
    if (!product) return [];
    const productId = typeof product.productId === "number" ? product.productId : null;
    const productName = text(product.productName)?.toLowerCase() ?? "";
    const listedSet = text(product.setName)?.toLowerCase() ?? "";
    const number = productNumberKey(text(record(product.customAttributes)?.number) ?? undefined);
    if (!productId || product.foilOnly !== true || !productName.includes(name) || number !== wanted) return [];
    if (listedSet !== setName && listedSet !== "deck exclusives") return [];
    return [productId];
  });
  for (const productId of hits) {
    const points = await fetchJson(`https://mpapi.tcgplayer.com/v2/product/${productId}/pricepoints`);
    const foil = (Array.isArray(points) ? points : []).find((entry) => record(entry)?.printingType === "Foil");
    const market = amount(record(foil)?.marketPrice);
    if (market == null) continue;
    return {
      key: "holofoil",
      label: variantLabel("holofoil"),
      market,
      low: amount(record(foil)?.lowPrice),
      mid: amount(record(foil)?.listedMedianPrice),
      high: null,
      currency: "USD",
      productUrl: `https://www.tcgplayer.com/product/${productId}`,
      image: tcgplayerImage(productId),
    };
  }
  return null;
}

async function attachHoloSiblings(ids: string[], source: Map<string, PriceQuote | null>): Promise<void> {
  const needing = ids.filter((id) => {
    const quote = source.get(id);
    return quote && !quote.variants.some((variant) => variant.key === "holofoil" || variant.key === "unlimitedHolofoil");
  });
  for (const group of chunk(needing, 4)) {
    await Promise.all(
      group.map(async (id) => {
        const quote = source.get(id);
        if (!quote) return;
        try {
          const sibling = await holoSibling(id);
          if (sibling) quote.variants.push(sibling);
        } catch {
          /* a missing holo sibling leaves the finishes TCGdex already listed */
        }
      }),
    );
  }
}

function printingKey(raw: string): string {
  return raw.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function fromTcgdex(card: Record<string, unknown>): PriceQuote | null {
  const pricing = record(card.pricing);
  const tcg = record(pricing?.tcgplayer);
  const market = record(pricing?.cardmarket);
  const variants: VariantQuote[] = [];
  let productUrl: string | null = null;
  if (tcg) {
    for (const [key, value] of Object.entries(tcg)) {
      if (key === "unit" || key === "updated") continue;
      const quote = record(value);
      if (!quote) continue;
      const productId = typeof quote.productId === "number" ? quote.productId : null;
      if (!productUrl && productId) productUrl = `https://www.tcgplayer.com/product/${productId}`;
      variants.push({
        key: printingKey(key),
        label: variantLabel(printingKey(key)),
        market: amount(quote.marketPrice),
        low: amount(quote.lowPrice),
        mid: amount(quote.midPrice),
        high: amount(quote.highPrice),
        currency: "USD",
        productUrl: productId ? `https://www.tcgplayer.com/product/${productId}` : null,
      });
    }
  }
  const plain = market ? euroSales(market, "") : null;
  const holo = market ? euroSales(market, "-holo") : null;
  const cardmarket: CardmarketQuote | null = plain && hasSale(plain)
    ? {
        ...plain,
        currency: "EUR",
        updatedAt: text(market?.updated),
        url: null,
        holo: holo && hasSale(holo) ? holo : null,
      }
    : null;
  if (variants.length === 0 && !cardmarket) return null;
  return {
    source: "tcgdex",
    updatedAt: text(tcg?.updated) ?? text(market?.updated),
    productUrl,
    variants,
    cardmarket,
    graded: [],
    trends: [],
  };
}

let setIds: Promise<Map<string, string>> | null = null;

function tcgdexSetIds(): Promise<Map<string, string>> {
  if (!setIds) {
    setIds = (async () => {
      const payload = await fetchJson("https://api.tcgdex.net/v2/en/sets");
      const byName = new Map<string, string>();
      for (const entry of Array.isArray(payload) ? payload : []) {
        const row = record(entry);
        const name = text(row?.name)?.toLowerCase();
        const id = text(row?.id);
        if (name && id && !byName.has(name)) byName.set(name, id);
      }
      const map = new Map<string, string>();
      for (const set of getCatalog().sets.values()) {
        const id = byName.get(set.name.toLowerCase());
        if (id) map.set(set.id, id);
      }
      return map;
    })().catch((error: unknown) => {
      setIds = null;
      throw error;
    });
  }
  return setIds;
}

function tcgdexCandidates(cardId: string, sets: Map<string, string>): string[] {
  const card = getCatalog().cards.find((entry) => entry.id === cardId);
  if (!card) return [cardId];
  const setId = sets.get(card.set) ?? card.set;
  const stripped = card.num.replace(/^0+(?=\d)/, "");
  return [...new Set([`${setId}-${card.num}`, `${setId}-${stripped}`, card.id])];
}

async function readTcgdex(id: string): Promise<PriceQuote | null> {
  const payload = await fetchJson(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(id)}`);
  const card = record(payload);
  return card ? fromTcgdex(card) : null;
}

async function fromTcgdexApi(ids: string[]): Promise<Map<string, PriceQuote | null>> {
  const found = new Map<string, PriceQuote | null>();
  let sets = new Map<string, string>();
  try {
    sets = await tcgdexSetIds();
  } catch {
    sets = new Map();
  }
  let cursor = 0;
  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor];
      cursor += 1;
      if (!id) return;
      let quote: PriceQuote | null = null;
      for (const candidate of tcgdexCandidates(id, sets)) {
        quote = await readTcgdex(candidate);
        if (quote) break;
      }
      found.set(id, quote);
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, ids.length) }, () => worker()));
  return found;
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
    const freshFor = hit?.quote ? TTL_MS : MISS_TTL_MS;
    if (hit && now - hit.at < freshFor) result[id] = hit.quote;
    else missing.push(id);
  }
  if (missing.length === 0) return result;

  const scrydex = await fromScrydexApi(missing);
  let source: Map<string, PriceQuote | null>;
  if (scrydex) {
    source = scrydex;
  } else {
    source = await fromTcgdexApi(missing);
    const missed = missing.filter((id) => !source.get(id));
    if (missed.length > 0) {
      const pokemon = await fromPokemonApi(missed);
      for (const [id, quote] of pokemon) {
        if (quote) source.set(id, quote);
      }
    }
  }
  await attachHoloSiblings(missing, source);
  const fresh: Record<string, PriceQuote | null> = {};
  for (const id of missing) {
    const quote = source.get(id) ?? null;
    cache.set(id, { at: now, quote });
    result[id] = quote;
    fresh[id] = quote;
  }
  recordSnapshots(fresh);
  return result;
}

export function priceSource(quotes: Record<string, PriceQuote | null>): "scrydex" | "pokemon-tcg" | "tcgdex" | "none" {
  for (const quote of Object.values(quotes)) {
    if (quote) return quote.source;
  }
  return "none";
}
