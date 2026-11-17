import { NextResponse } from "next/server";
import { appOrigin, discordConfigured, OAUTH_COOKIE, sessionCookie, unseal } from "@/lib/session";

type DiscordUser = { id?: string; username?: string; global_name?: string | null; avatar?: string | null };

export async function GET(request: Request) {
  const origin = appOrigin(request);
  const fail = (reason: string) => {
    const response = NextResponse.redirect(`${origin}/?signin=${reason}`);
    response.cookies.delete(OAUTH_COOKIE);
    return response;
  };
  if (!discordConfigured()) return fail("unconfigured");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieHeader = request.headers.get("cookie") ?? "";
  const stored = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OAUTH_COOKIE}=`))
    ?.slice(OAUTH_COOKIE.length + 1);
  const expected = unseal<{ state: string }>(stored);
  if (!code || !state || !expected || expected.state !== state) return fail("failed");

  try {
    const token = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID ?? "",
        client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
        grant_type: "authorization_code",
        code,
        redirect_uri: `${origin}/api/auth/discord/callback`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!token.ok) return fail("failed");
    const { access_token } = (await token.json()) as { access_token?: string };
    if (!access_token) return fail("failed");
    const me = await fetch("https://discord.com/api/users/@me", {
      headers: { authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!me.ok) return fail("failed");
    const user = (await me.json()) as DiscordUser;
    if (!user.id || !/^[0-9]{5,25}$/.test(user.id)) return fail("failed");
    const cookie = sessionCookie({
      id: user.id,
      name: user.global_name || user.username || "Discord user",
      avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64` : null,
      provider: "discord",
    });
    if (!cookie) return fail("unconfigured");
    const response = NextResponse.redirect(`${origin}/?signin=ok`);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    response.cookies.delete(OAUTH_COOKIE);
    return response;
  } catch {
    return fail("failed");
  }
}
