import { getCatalog, toPublic } from "@/lib/catalog";
import { marketFor } from "@/lib/ebay";
import { requireViewer } from "@/lib/guard";
import { limited } from "@/lib/rate-limit";

const ID = /^[a-z0-9][a-z0-9-]{1,48}$/i;
const PRINTING = /^[A-Za-z0-9]{1,40}$/;

function requested(body: unknown): { id: string; printing: string | null }[] {
  if (!body || typeof body !== "object") return [];
  const record = body as { ids?: unknown; cards?: unknown };
  if (Array.isArray(record.cards)) {
    return record.cards.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const card = entry as { id?: unknown; printing?: unknown };
      if (typeof card.id !== "string" || !ID.test(card.id)) return [];
      const printing = typeof card.printing === "string" && PRINTING.test(card.printing) ? card.printing : null;
      return [{ id: card.id, printing }];
    });
  }
  if (!Array.isArray(record.ids)) return [];
  return record.ids.flatMap((id) => (typeof id === "string" && ID.test(id) ? [{ id, printing: null }] : []));
}

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
  const asked = requested(body);
  if (asked.length === 0 || asked.length > 24) {
    return Response.json({ error: "Send up to 24 cards for live listings." }, { status: 400 });
  }

  const catalog = getCatalog();
  const cards = asked.flatMap((entry) => {
    const card = catalog.cards.find((item) => item.id === entry.id);
    return card ? [{ card: toPublic(catalog, card), printing: entry.printing }] : [];
  });

  try {
    const market = await marketFor(cards);
    return Response.json(market, { headers: { "cache-control": "private, no-store" } });
  } catch {
    console.error("market failed");
    return Response.json({ error: "Listings didn’t refresh.", configured: false, results: [] }, { status: 502 });
  }
}
