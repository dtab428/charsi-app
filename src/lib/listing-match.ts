import { editionOf, finishOf, type Edition, type Finish } from "./format";
import type { Wear } from "./wear";

// Alt keeps a printing by asking for that printing and rejecting the other one.
// A plain name-and-number search ranks Unlimited next to 1st edition.
export function editionClause(edition: Edition | null): string {
  if (edition === "first") return "1st -unlimited -unl";
  if (edition === "unlimited") return "Unlimited -1st -shadowless";
  // Unlimited shadowless is the shadowless printing that is not 1st edition, so the word unlimited stays.
  if (edition === "shadowless") return "shadowless -1st -first";
  return "";
}

// Reverse holo has to be named. A plain “Rare Holo” is the regular holo.
export function finishClause(finish: Finish | null): string {
  if (finish === "reverse") return "reverse";
  if (finish === "holo") return "-reverse";
  return "";
}

function saysFirst(title: string): boolean {
  return /\b(1st|first)\b/i.test(title);
}

function saysUnlimited(title: string): boolean {
  return /\bunlimited\b|\bunltd\b|\bunl\b/i.test(title);
}

function saysShadowless(title: string): boolean {
  return /\bshadowless\b/i.test(title);
}

function saysReverse(title: string): boolean {
  // EX-era sellers often say “stamped” for the reverse holo and never say reverse.
  return /\breverse\b/i.test(title) || /\brev\.?\s+holo\b/i.test(title) || /\bstamped\b/i.test(title);
}

function saysNonHolo(title: string): boolean {
  return /non[-\s]?holo/i.test(title);
}

function saysHolo(title: string): boolean {
  return /\bholo\b/i.test(title) && !saysNonHolo(title);
}

// Sellers write 4/113 or #4. A title for 40, 14/113, or another set’s 033/131 is a different card.
export function listingMatchesNumber(title: string, number: string, printed: number | null): boolean {
  const trimmed = number.trim();
  const digits = trimmed.replace(/^0+(?=\d)/, "");
  if (/^\d+$/.test(digits)) {
    if (printed && new RegExp(`(?<!\\d)0*${digits}\\s*/\\s*0*${printed}(?!\\d)`, "i").test(title)) return true;
    return new RegExp(`#\\s*0*${digits}(?!\\d)`, "i").test(title);
  }
  if (!trimmed) return true;
  return new RegExp(`\\b${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(title);
}

const GRADER = "PSA|BGS|CGC|SGC|TAG";

export type GradeAsk = { company: string; grade: string };

export function gradesInTitle(title: string): GradeAsk[] {
  const re = new RegExp(`\\b(${GRADER})\\s*([0-9]{1,2}(?:\\.5)?)(?![\\d.])`, "gi");
  return [...title.matchAll(re)].map((match) => ({ company: (match[1] ?? "").toUpperCase(), grade: match[2] ?? "" }));
}

// null keeps raw and graded. "raw" drops slabs. A company and grade keeps that grade only.
export function listingMatchesGrade(title: string, ask: GradeAsk | "raw" | null): boolean {
  if (!ask) return true;
  const found = gradesInTitle(title);
  if (ask === "raw") return found.length === 0 && !new RegExp(`\\b(${GRADER}|graded)\\b`, "i").test(title);
  return found.some((entry) => entry.company === ask.company.toUpperCase() && entry.grade === ask.grade);
}

const WEAR_TITLE: Record<Wear, RegExp> = {
  NM: /\b(near mint|n\/?m|mint)\b/i,
  LP: /\b(lightly played|\blp\b)/i,
  MP: /\b(moderately played|\bmp\b)/i,
  HP: /\bheavily played\b/i,
  DMG: /\b(damaged|dmg)\b/i,
};

export function listingMatchesWear(title: string, wear: Wear | null): boolean {
  if (!wear) return true;
  return WEAR_TITLE[wear].test(title);
}

export function listingMatchesPrinting(title: string, printing: string | null | undefined): boolean {
  const edition = editionOf(printing);
  const finish = finishOf(printing);
  if (edition === "first" && (!saysFirst(title) || saysUnlimited(title))) return false;
  if (edition === "unlimited" && (!saysUnlimited(title) || saysFirst(title) || saysShadowless(title))) return false;
  if (edition === "shadowless" && (!saysShadowless(title) || saysFirst(title))) return false;
  if (finish === "reverse" && !saysReverse(title)) return false;
  if (finish === "holo" && (saysReverse(title) || saysNonHolo(title))) return false;
  if (finish === "normal" && (saysReverse(title) || saysHolo(title))) return false;
  return true;
}
