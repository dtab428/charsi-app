import { CURRENCIES, type FxTable } from "@/lib/fx";

const DAY = 6 * 60 * 60 * 1000;
let cache: { at: number; table: FxTable } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < DAY) {
    return Response.json(cache.table, { headers: { "cache-control": "public, max-age=3600" } });
  }
  const codes = CURRENCIES.map((entry) => entry.code).filter((code) => code !== "USD");
  try {
    const response = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${codes.join(",")}`, {
      signal: AbortSignal.timeout(8_000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) throw new Error("rates");
    const payload = (await response.json()) as { date?: string; rates?: Record<string, number> };
    const rates: Record<string, number> = {};
    for (const code of codes) {
      const rate = payload.rates?.[code];
      if (typeof rate === "number" && rate > 0) rates[code] = rate;
    }
    if (!rates.EUR || !rates.GBP) throw new Error("rates");
    const table: FxTable = { base: "USD", date: payload.date ?? "", rates };
    cache = { at: Date.now(), table };
    return Response.json(table, { headers: { "cache-control": "public, max-age=3600" } });
  } catch {
    if (cache) return Response.json(cache.table);
    return Response.json({ error: "Exchange rates didn’t load." }, { status: 502 });
  }
}
