import { getCatalog } from "@/lib/catalog";
import { requireViewer } from "@/lib/guard";
import { readHistory } from "@/lib/history";
import { limited } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer) return viewer;
  const blocked = limited(request, "history", 60);
  if (blocked) return blocked;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!getCatalog().cards.some((card) => card.id === id)) return Response.json({ error: "Unknown card." }, { status: 404 });
  return Response.json({ snapshots: await readHistory(id) }, { headers: { "cache-control": "private, no-store" } });
}
