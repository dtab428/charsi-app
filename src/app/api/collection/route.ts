import { getCatalog, toPublic } from "@/lib/catalog";
import {
  addToCollection,
  listCollection,
  removeFromCollection,
  setQuantity,
  type CollectionEntry,
} from "@/lib/collection-store";
import { GRADES, type Company } from "@/lib/feed";
import { requireViewer } from "@/lib/guard";
import { limited } from "@/lib/rate-limit";
import { currentUser, sameOrigin } from "@/lib/session";

const noStore = { "cache-control": "private, no-store" };

function view(entries: CollectionEntry[]) {
  const catalog = getCatalog();
  const index = new Map(catalog.cards.map((card) => [card.id, card]));
  return entries.flatMap((entry) => {
    const card = index.get(entry.cardId);
    return card ? [{ ...entry, card: toPublic(catalog, card) }] : [];
  });
}

async function guard(request: Request, mutating: boolean) {
  const viewer = await requireViewer(request);
  if (viewer) return { response: viewer } as const;
  if (mutating && !sameOrigin(request)) return { response: Response.json({ error: "Not allowed." }, { status: 403 }) } as const;
  const blocked = limited(request, mutating ? "collection-write" : "collection-read", mutating ? 60 : 120);
  if (blocked) return { response: blocked } as const;
  const user = await currentUser();
  if (!user) return { response: Response.json({ error: "Sign in with Discord to use My Collection." }, { status: 401 }) } as const;
  return { user } as const;
}

async function body(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = (await request.json()) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const checked = await guard(request, false);
  if ("response" in checked) return checked.response;
  return Response.json({ entries: view(await listCollection(checked.user.id)) }, { headers: noStore });
}

export async function POST(request: Request) {
  const checked = await guard(request, true);
  if ("response" in checked) return checked.response;
  const input = await body(request);
  if (!input) return Response.json({ error: "That wasn’t readable." }, { status: 400 });

  const cardId = typeof input.cardId === "string" ? input.cardId : "";
  if (!getCatalog().cards.some((card) => card.id === cardId)) return Response.json({ error: "That card isn’t in the catalog." }, { status: 400 });
  const quantity = Number.isInteger(input.quantity) ? Math.max(1, Math.min(99, input.quantity as number)) : 1;

  let company: string | null = null;
  let grade: string | null = null;
  if (input.kind === "graded") {
    const asked = typeof input.company === "string" ? input.company : "";
    if (!(asked in GRADES)) return Response.json({ error: "Pick a grading company." }, { status: 400 });
    const allowed = GRADES[asked as Company];
    if (typeof input.grade !== "string" || !allowed.includes(input.grade)) return Response.json({ error: "Pick a grade." }, { status: 400 });
    company = asked;
    grade = input.grade;
  } else if (input.kind !== "raw") {
    return Response.json({ error: "Choose raw or graded." }, { status: 400 });
  }

  const printing = typeof input.printing === "string" && /^[a-z0-9-]{1,40}$/.test(input.printing) ? input.printing : null;

  try {
    const entries = await addToCollection(checked.user.id, { cardId, kind: input.kind, company, grade, printing, quantity });
    return Response.json({ entries: view(entries) }, { headers: noStore });
  } catch {
    return Response.json({ error: "My Collection is full." }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  const checked = await guard(request, true);
  if ("response" in checked) return checked.response;
  const input = await body(request);
  if (!input || typeof input.id !== "string" || !Number.isInteger(input.quantity)) {
    return Response.json({ error: "That wasn’t readable." }, { status: 400 });
  }
  const entries = await setQuantity(checked.user.id, input.id, input.quantity as number);
  return Response.json({ entries: view(entries) }, { headers: noStore });
}

export async function DELETE(request: Request) {
  const checked = await guard(request, true);
  if ("response" in checked) return checked.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing card." }, { status: 400 });
  const entries = await removeFromCollection(checked.user.id, id);
  return Response.json({ entries: view(entries) }, { headers: noStore });
}
