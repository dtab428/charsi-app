import { getCatalog } from "@/lib/catalog";
import { requireViewer } from "@/lib/guard";
import { limited } from "@/lib/rate-limit";
import { recentTrades } from "@/lib/reddit";
import { readTrade } from "@/lib/trade-read";

export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer) return viewer;
  const blocked = limited(request, "trades", 30);
  if (blocked) return blocked;
  try {
    const catalog = getCatalog();
    const posts = await recentTrades();
    const rows = posts.map((post) => ({ ...post, selftext: undefined, ...readTrade(catalog, post) }));
    return Response.json({ posts: rows, discord: "LowPopping needs a bot invited to that server. A trade post is a listing, so it is not written into a collection." }, { headers: { "cache-control": "private, max-age=120" } });
  } catch {
    console.error("trades failed");
    return Response.json({ error: "Trade posts didn’t load." }, { status: 502 });
  }
}
