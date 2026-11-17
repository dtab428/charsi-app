import { NextResponse } from "next/server";
import { sameOrigin, SESSION_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
