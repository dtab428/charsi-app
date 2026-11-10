const hits = new Map<string, number[]>();

export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "local";
  return ip.slice(0, 80);
}

export function limited(request: Request, bucket: string, limit: number, windowMs = 60_000): Response | null {
  const key = `${bucket}:${clientAddress(request)}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return Response.json({ error: "Too many pulls in a minute. Give it a short rest." }, { status: 429 });
  }
  recent.push(now);
  hits.set(key, recent);
  return null;
}
