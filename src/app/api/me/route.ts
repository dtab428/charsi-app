import { currentUser, discordConfigured } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  return Response.json(
    { configured: discordConfigured(), user },
    { headers: { "cache-control": "private, no-store" } },
  );
}
