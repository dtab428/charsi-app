import { lowestAsk, readAskRequest } from "@/lib/asks";
import { requireViewer } from "@/lib/guard";
import { limited } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer) return viewer;
  const blocked = limited(request, "asks", 40);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That request wasn’t readable." }, { status: 400 });
  }
  const asked = readAskRequest(body);
  if (!asked) return Response.json({ error: "Send a product and a condition." }, { status: 400 });
  if (asked.wear === "NM") return Response.json({ amount: null, wear: asked.wear });

  try {
    const amount = await lowestAsk(asked);
    return Response.json({ amount, wear: asked.wear }, { headers: { "cache-control": "private, no-store" } });
  } catch {
    console.error("asks failed");
    return Response.json({ error: "Condition prices didn’t load.", amount: null }, { status: 502 });
  }
}
