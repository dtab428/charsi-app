import { asWear, WEAR_LABEL, type Wear } from "./wear";

const PRINTING: Record<string, string> = {
  normal: "Normal",
  holo: "Holofoil",
  holofoil: "Holofoil",
  "reverse-holo": "Reverse Holofoil",
  reverseHolofoil: "Reverse Holofoil",
  "1stEdition": "1st Edition",
  "1st-edition": "1st Edition",
  "1stEditionHolofoil": "1st Edition Holofoil",
  "1st-edition-holo": "1st Edition Holofoil",
  unlimited: "Unlimited",
  unlimitedHolofoil: "Unlimited Holofoil",
  "unlimited-holo": "Unlimited Holofoil",
};

type Hit = { at: number; amount: number | null };
const cache = new Map<string, Hit>();
const TTL_MS = 10 * 60 * 1000;

function printingName(key: string | null): string | null {
  if (!key) return null;
  return PRINTING[key] ?? null;
}

async function listed(query: string, term: Record<string, string[]>): Promise<{ productId?: number; listings?: { price?: number; condition?: string; printing?: string }[] }[]> {
  try {
    const response = await fetch(`https://mp-search-api.tcgplayer.com/v1/search/request?q=${encodeURIComponent(query)}&isList=false`, {
      method: "POST",
      signal: AbortSignal.timeout(12_000),
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        algorithm: "sales_synonym_v2",
        from: 0,
        size: 8,
        filters: { term: { productLineName: ["pokemon"] }, range: {}, match: {} },
        listingSearch: { filters: { term, range: {}, match: {} } },
        context: { cart: {}, shippingCountry: "US" },
        settings: { useFuzzySearch: true },
        sort: { field: "price", order: "asc" },
      }),
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { results?: { results?: { productId?: number; listings?: { price?: number; condition?: string; printing?: string }[] }[] }[] };
    return payload.results?.[0]?.results ?? [];
  } catch {
    return [];
  }
}

export async function lowestAsk(input: { productId: number; name: string; setName: string; number: string; printing: string | null; wear: Wear }): Promise<number | null> {
  const printing = printingName(input.printing);
  const key = `${input.productId}:${printing ?? ""}:${input.wear}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.amount;

  const term: Record<string, string[]> = {
    condition: [WEAR_LABEL[input.wear]],
    language: ["English"],
  };
  if (printing) term.printing = [printing];
  const queries = [`${input.name} ${input.setName}`, `${input.name} ${input.number}`].map((query) => query.replace(/\s+/g, " ").trim()).filter(Boolean);
  let amount: number | null = null;
  try {
    for (const query of queries) {
      const rows = await listed(query, term);
      const product = rows.find((row) => row.productId === input.productId);
      if (!product) continue;
      const prices = (product.listings ?? [])
        .filter((listing) => listing.condition === WEAR_LABEL[input.wear] && (!printing || listing.printing === printing))
        .map((listing) => listing.price)
        .filter((price): price is number => typeof price === "number" && price > 0);
      amount = prices.length ? Math.min(...prices) : null;
      break;
    }
  } catch {
    amount = null;
  }
  cache.set(key, { at: Date.now(), amount });
  return amount;
}

export function readAskRequest(body: unknown): { productId: number; name: string; setName: string; number: string; printing: string | null; wear: Wear } | null {
  if (!body || typeof body !== "object") return null;
  const record = body as { productId?: unknown; name?: unknown; setName?: unknown; number?: unknown; printing?: unknown; wear?: unknown };
  const productId = typeof record.productId === "number" ? record.productId : Number(record.productId);
  const name = typeof record.name === "string" ? record.name.slice(0, 80).trim() : "";
  const setName = typeof record.setName === "string" ? record.setName.slice(0, 80).trim() : "";
  const number = typeof record.number === "string" ? record.number.slice(0, 12).trim() : "";
  const printing = typeof record.printing === "string" && /^[a-z0-9-]{1,40}$/i.test(record.printing) ? record.printing : null;
  if (!Number.isInteger(productId) || productId < 1 || productId > 99_999_999 || !name) return null;
  return { productId, name, setName, number, printing, wear: asWear(typeof record.wear === "string" ? record.wear : null) };
}
