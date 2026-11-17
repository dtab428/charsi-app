import fs from "node:fs/promises";
import path from "node:path";
import type { PriceQuote } from "./types";

export type Snapshot = {
  d: string;
  v: Record<string, { market: number | null; low: number | null }>;
  cm: { avg1: number | null; avg7: number | null; avg30: number | null; trend: number | null } | null;
};

const DIR = path.join(process.cwd(), ".data", "history");
const MAX_DAYS = 1200;
const ID = /^[a-z0-9][a-z0-9-]{1,48}$/i;
const queues = new Map<string, Promise<unknown>>();

function fileFor(id: string): string {
  if (!ID.test(id)) throw new Error("bad id");
  return path.join(DIR, `${id}.json`);
}

export async function readHistory(id: string): Promise<Snapshot[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(fileFor(id), "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as Snapshot[]) : [];
  } catch {
    return [];
  }
}

function snapshotOf(quote: PriceQuote, day: string): Snapshot | null {
  const v: Snapshot["v"] = {};
  for (const variant of quote.variants) {
    if (variant.market != null || variant.low != null) v[variant.key] = { market: variant.market, low: variant.low };
  }
  const cm = quote.cardmarket
    ? { avg1: quote.cardmarket.avg1, avg7: quote.cardmarket.avg7, avg30: quote.cardmarket.avg30, trend: quote.cardmarket.trend }
    : null;
  if (Object.keys(v).length === 0 && !cm) return null;
  return { d: day, v, cm };
}

export function recordSnapshots(quotes: Record<string, PriceQuote | null>): void {
  const day = new Date().toISOString().slice(0, 10);
  for (const [id, quote] of Object.entries(quotes)) {
    if (!quote || !ID.test(id)) continue;
    const snap = snapshotOf(quote, day);
    if (!snap) continue;
    const run = (queues.get(id) ?? Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        const rows = await readHistory(id);
        const last = rows[rows.length - 1];
        if (last && last.d === day) rows[rows.length - 1] = snap;
        else rows.push(snap);
        await fs.mkdir(DIR, { recursive: true });
        const target = fileFor(id);
        const temp = `${target}.${process.pid}.tmp`;
        await fs.writeFile(temp, JSON.stringify(rows.slice(-MAX_DAYS)));
        await fs.rename(temp, target);
      })
      .catch(() => undefined);
    queues.set(id, run);
  }
}
