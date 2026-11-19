import { currentUser } from "./session";
import { requireIdentity } from "../../cursor/identity";

// A request is admitted when it carries the Cursor app identity, or when the
// viewer is signed in with Discord. The Cursor identity gates a published
// app's preview; a Discord session is the only way a real visitor signs in.
export async function requireViewer(request: Request): Promise<Response | null> {
  if (process.env.CURSOR_APP_ID?.trim()) {
    const identity = await requireIdentity(request);
    if (identity instanceof Response) return identity;
    return null;
  }
  if (await currentUser()) return null;
  return Response.json({ error: "Sign in with Discord to continue." }, { status: 401 });
}
