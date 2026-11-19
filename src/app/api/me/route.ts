import { currentUser, discordConfigured, missingDiscord } from "@/lib/session";

export async function GET() {
  const user = await currentUser();
  const missing = missingDiscord();
  return Response.json(
    { configured: discordConfigured(), missing, user },
    { headers: { "cache-control": "private, no-store" } },
  );
}
