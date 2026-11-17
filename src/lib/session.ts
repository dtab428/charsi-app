import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "charsi_session";
export const OAUTH_COOKIE = "charsi_oauth";
const WEEK = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: string;
  name: string;
  avatar: string | null;
  provider: "discord" | "local";
};

const production = process.env.NODE_ENV === "production";

export function discordConfigured(): boolean {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && secret());
}

function secret(): string | null {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 16) return configured;
  if (production) return null;
  const file = path.join(process.cwd(), ".data", "dev-session-secret");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    const fresh = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, fresh, { mode: 0o600 });
    return fresh;
  }
}

function mac(value: string, key: string): string {
  return crypto.createHmac("sha256", key).update(value).digest("base64url");
}

export function seal(payload: object, maxAgeSeconds: number): string | null {
  const key = secret();
  if (!key) return null;
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds })).toString("base64url");
  return `${body}.${mac(body, key)}`;
}

export function unseal<T>(token: string | undefined): T | null {
  const key = secret();
  if (!key || !token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = mac(body, key);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp?: number };
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now() / 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const LOCAL_USER: SessionUser = { id: "local", name: "Local profile", avatar: null, provider: "local" };

export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const session = unseal<SessionUser>(store.get(SESSION_COOKIE)?.value);
  if (session && /^[0-9]{5,25}$/.test(session.id)) {
    return { id: session.id, name: String(session.name).slice(0, 80), avatar: session.avatar ?? null, provider: "discord" };
  }
  if (!production && !discordConfigured()) return LOCAL_USER;
  return null;
}

export function sessionCookie(user: SessionUser) {
  const value = seal(user, WEEK);
  if (!value) return null;
  return { name: SESSION_COOKIE, value, options: cookieOptions(WEEK) };
}

export function cookieOptions(maxAge: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure: production, path: "/", maxAge };
}

export function appOrigin(request: Request): string {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return new URL(request.url).origin;
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return `${proto}://${host}`;
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
