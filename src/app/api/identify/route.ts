import { getCatalog } from "@/lib/catalog";
import { lineFromOcr, repairLine } from "@/lib/ocr-line";
import { readImage } from "@/lib/ocr";
import { limited } from "@/lib/rate-limit";
import { resolveText } from "@/lib/resolve";

export const runtime = "nodejs";

const MAX_BYTES = 700_000;

async function band(form: FormData, field: string): Promise<Buffer | null> {
  const value = form.get(field);
  if (!(value instanceof File)) return null;
  if (value.size === 0 || value.size > MAX_BYTES) return null;
  const bytes = Buffer.from(await value.arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes[0] === 0x89 && bytes.toString("ascii", 1, 4) === "PNG";
  const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!jpeg && !png && !webp) return null;
  return bytes;
}

export async function POST(request: Request) {
  const blocked = limited(request, "identify", 40);
  if (blocked) return blocked;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "That photo didn’t come through." }, { status: 400 });
  }

  const name = await band(form, "name");
  const number = await band(form, "number");
  if (!name) {
    return Response.json({ error: "Drop a JPEG, PNG, or WebP of the card." }, { status: 400 });
  }

  try {
    const nameText = await readImage(name);
    const numberText = number ? await readImage(number) : "";
    const catalog = getCatalog();
    const line = repairLine(lineFromOcr(nameText, numberText), (token) => catalog.tokenIndex.has(token), (token) => {
      const hits = (catalog.dictionary.get(token[0] ?? "") ?? []).filter((word) => word.startsWith(token) && word.length - token.length <= 4);
      return hits.length === 1 ? hits[0] : null;
    });
    if (!line) {
      return Response.json({
        line: "",
        item: {
          raw: "Photo",
          quantity: 1,
          modifiers: [],
          status: "unmatched",
          confidence: 0,
          notes: ["The name didn’t read. Type it, or try a closer photo of the front."],
          corrections: [],
          card: null,
          alternatives: [],
        },
      });
    }
    const item = resolveText(catalog, line)[0];
    if (!item) {
      return Response.json({ error: "The catalog didn’t answer." }, { status: 500 });
    }
    return Response.json({ line, item }, { headers: { "cache-control": "no-store" } });
  } catch {
    console.error("identify failed");
    return Response.json({ error: "That photo didn’t read." }, { status: 500 });
  }
}
