import { challengeResponse, deletionEndpoint, deletionToken } from "@/lib/ebay-deletion";

export async function GET(request: Request) {
  const token = deletionToken();
  if (!token) {
    return Response.json({ error: "The deletion token is not set." }, { status: 503 });
  }
  const challenge = new URL(request.url).searchParams.get("challenge_code") ?? "";
  if (!challenge || challenge.length > 128) {
    return Response.json({ error: "Missing challenge_code." }, { status: 400 });
  }
  return Response.json(
    { challengeResponse: challengeResponse(challenge, token, deletionEndpoint()) },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST() {
  // Charsi keeps no eBay user records. Acknowledge the notice and retain nothing from it.
  return new Response(null, { status: 200 });
}
