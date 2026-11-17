import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { appOrigin, cookieOptions, discordConfigured, OAUTH_COOKIE, seal } from "@/lib/session";

export async function GET(request: Request) {
  const origin = appOrigin(request);
  if (!discordConfigured()) return NextResponse.redirect(`${origin}/?signin=unconfigured`);
  const state = crypto.randomBytes(16).toString("hex");
  const sealed = seal({ state }, 600);
  if (!sealed) return NextResponse.redirect(`${origin}/?signin=unconfigured`);
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID ?? "");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("redirect_uri", `${origin}/api/auth/discord/callback`);
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "none");
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_COOKIE, sealed, cookieOptions(600));
  return response;
}
