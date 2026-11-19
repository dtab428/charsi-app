import { editionOf, finishOf, type Edition, type Finish } from "./format";

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
