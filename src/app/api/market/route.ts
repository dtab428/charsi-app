import { getCatalog, toPublic } from "@/lib/catalog";
import { marketFor } from "@/lib/ebay";
import { requireViewer } from "@/lib/guard";
import { limited } from "@/lib/rate-limit";

const ID = /^[a-z0-9][a-z0-9-]{1,48}$/i;

export async function POST(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer) return viewer;
  const blocked = limited(request, "market", 20);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The card list wasn’t readable." }, { status: 400 });
  }
  const ids = body && typeof body === "object" && Array.isArray((body as { ids?: unknown }).ids)
    ? (body as { ids: unknown[] }).ids.filter((id): id is string => typeof id === "string" && ID.test(id))
    : [];
  if (ids.length === 0 || ids.length > 24) {
    return Response.json({ error: "Send up to 24 cards for live listings." }, { status: 400 });
  }

  const catalog = getCatalog();
  const cards = [...new Set(ids)]
    .map((id) => catalog.cards.find((card) => card.id === id))
    .filter((card) => card != null)
    .map((card) => toPublic(catalog, card));

  try {
    const market = await marketFor(cards);
    return Response.json(market, { headers: { "cache-control": "private, no-store" } });
  } catch {
    console.error("market failed");
    return Response.json({ error: "Listings didn’t refresh.", configured: false, results: [] }, { status: 502 });
  }
}
