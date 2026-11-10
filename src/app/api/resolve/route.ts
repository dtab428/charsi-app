import { getCatalog } from "@/lib/catalog";
import { parseList } from "@/lib/parse";
import { limited } from "@/lib/rate-limit";
import { resolveText } from "@/lib/resolve";

export async function POST(request: Request) {
  const blocked = limited(request, "resolve", 24);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The list wasn’t readable." }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as { text?: unknown; game?: unknown }) : {};
  const text = typeof record.text === "string" ? record.text : "";
  const game = typeof record.game === "string" ? record.game : "pokemon";
  if (game !== "pokemon") {
    return Response.json({ error: "That catalog isn’t connected yet. Pokémon is the live desk." }, { status: 400 });
  }
  if (text.length > 12_000) {
    return Response.json({ error: "That list is too long. Split it and pull again." }, { status: 400 });
  }
  if (parseList(text).length > 80) {
    return Response.json({ error: "Keep a pull to 80 cards." }, { status: 400 });
  }

  try {
    const items = resolveText(getCatalog(), text);
    return Response.json({ items }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("resolve failed");
    const message = error instanceof RangeError ? error.message : "The catalog couldn’t be searched.";
    return Response.json({ error: message }, { status: 500 });
  }
}
