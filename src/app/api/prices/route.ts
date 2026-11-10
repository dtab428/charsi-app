import { getCatalog } from "@/lib/catalog";
import { requireViewer } from "@/lib/guard";
import { priceSource, quotesFor } from "@/lib/prices";
import { limited } from "@/lib/rate-limit";

const ID = /^[a-z0-9][a-z0-9-]{1,48}$/i;

export async function POST(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer) return viewer;
  const blocked = limited(request, "prices", 30);
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
  if (ids.length === 0 || ids.length > 80) {
    return Response.json({ error: "Send up to 80 catalog cards." }, { status: 400 });
  }

  const catalog = getCatalog();
  const known = [...new Set(ids)].filter((id) => catalog.cards.some((card) => card.id === id));
  try {
    const quotes = await quotesFor(known);
    return Response.json(
      { source: priceSource(quotes), quotes },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch {
    console.error("prices failed");
    return Response.json({ error: "Quotes didn’t refresh.", source: "none", quotes: {} }, { status: 502 });
  }
}
