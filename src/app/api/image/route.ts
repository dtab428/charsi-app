import { allowedImageUrl } from "@/lib/links";
import { limited } from "@/lib/rate-limit";

const MAX_BYTES = 9_000_000;

export async function GET(request: Request) {
  const blocked = limited(request, "image", 240);
  if (blocked) return blocked;
  const src = new URL(request.url).searchParams.get("src");
  if (!src || !allowedImageUrl(src)) {
    return Response.json({ error: "That picture isn’t from the card catalog." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(src, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { accept: "image/avif,image/webp,image/png,image/jpeg,*/*" },
    });
  } catch {
    return Response.json({ error: "The picture didn’t load." }, { status: 502 });
  }
  if (upstream.status >= 300 && upstream.status < 400) {
    return Response.json({ error: "The picture host redirected." }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: "The picture didn’t load." }, { status: 502 });
  }
  const type = upstream.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) {
    return Response.json({ error: "The catalog host did not return a picture." }, { status: 502 });
  }
  const declared = Number(upstream.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) {
    return Response.json({ error: "That picture is too large." }, { status: 413 });
  }

  const reader = upstream.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      return Response.json({ error: "That picture is too large." }, { status: 413 });
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Response(body, {
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=86400",
    },
  });
}
