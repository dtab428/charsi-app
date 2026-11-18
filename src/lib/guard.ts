import { requireIdentity } from "../../cursor/identity";

export async function requireViewer(request: Request): Promise<Response | null> {
  if (!process.env.CURSOR_APP_ID?.trim()) return null;
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  return null;
}
