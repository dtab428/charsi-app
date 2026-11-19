import { asWear, isWear } from "./wear";

const CARD = /^[a-z0-9][a-z0-9-]{1,48}$/i;
const PRINTING = /^[a-z0-9-]{1,40}$/;
const CONDITION = /^(raw|[a-z]{2,4})$/i;
const GRADE = /^[0-9]{1,2}(\.5)?$/;

const SOURCES = ["tcgplayer", "cardmarket", "ebay"];

export type LineShare = {
  removed: boolean;
  card: string | null;
  printing: string | null;
  condition: string | null;
  grade: string | null;
  wear: string | null;
  off: boolean;
};

export type FilterShare = { source: string | null; condition: string | null; grade: string | null; wear: string | null };

export type DeskShare = { q: string; lines: LineShare[]; filters: FilterShare };

export const EMPTY_LINE: LineShare = { removed: false, card: null, printing: null, condition: null, grade: null, wear: null, off: false };

function clean(q: string): string {
  return q
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .trim();
}

function parseLine(token: string): LineShare {
  if (token === "-") return { ...EMPTY_LINE, removed: true };
  const parts = token.split("_");
  let off = false;
  if (parts[parts.length - 1] === "off") {
    off = true;
    parts.pop();
  }
  const [card, printing, condition, grade, wear] = parts;
  return {
    removed: false,
    card: card && CARD.test(card) ? card : null,
    printing: printing && PRINTING.test(printing) ? printing : null,
    condition: condition && CONDITION.test(condition) ? condition : null,
    grade: grade && GRADE.test(grade) ? grade : null,
    wear: wear && isWear(wear) ? asWear(wear) : null,
    off,
  };
}

function lineToken(line: LineShare): string {
  if (line.removed) return "-";
  const parts = [
    line.card && CARD.test(line.card) ? line.card : "",
    line.card && line.printing && PRINTING.test(line.printing) ? line.printing : "",
    line.condition && CONDITION.test(line.condition) ? line.condition : "",
    line.condition && line.grade && GRADE.test(line.grade) ? line.grade : "",
  ];
  const wear = line.wear && isWear(line.wear) && line.wear.toUpperCase() !== "NM" ? line.wear.toUpperCase() : "";
  if (wear) parts.push(wear);
  if (line.off) parts.push("off");
  while (parts.length && !parts[parts.length - 1]) parts.pop();
  return parts.join("_");
}

export function deskShareFrom(search: string): DeskShare | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const q = clean(params.get("q") ?? "");
  if (!q || q.length > 2000) return null;
  let lines = params.getAll("i").slice(0, 80).map(parseLine);
  if (lines.length === 0) {
    const card = params.get("card");
    const printing = params.get("printing");
    if (card) lines = [parseLine(`${card}_${printing ?? ""}`)];
  }
  const source = params.get("src");
  const condition = params.get("cond");
  const grade = params.get("grade");
  return {
    q,
    lines,
    filters: {
      source: source && SOURCES.includes(source) ? source : null,
      condition: condition && CONDITION.test(condition) ? condition : null,
      grade: grade && GRADE.test(grade) ? grade : null,
      wear: isWear(params.get("wear")) ? asWear(params.get("wear")) : null,
    },
  };
}

export function deskShareHref(q: string, lines: LineShare[] = [], filters: Partial<FilterShare> = {}): string {
  const params = new URLSearchParams();
  params.set("q", clean(q));
  const tokens = lines.map(lineToken);
  while (tokens.length && !tokens[tokens.length - 1]) tokens.pop();
  tokens.forEach((token) => params.append("i", token));
  if (filters.source && SOURCES.includes(filters.source)) params.set("src", filters.source);
  if (filters.condition && CONDITION.test(filters.condition) && filters.condition.toLowerCase() !== "raw") {
    params.set("cond", filters.condition);
    if (filters.grade && GRADE.test(filters.grade)) params.set("grade", filters.grade);
  } else if (filters.wear && isWear(filters.wear) && filters.wear.toUpperCase() !== "NM") {
    params.set("wear", filters.wear.toUpperCase());
  }
  return `/?${params.toString()}`;
}
