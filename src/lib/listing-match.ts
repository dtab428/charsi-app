import { editionOf, finishOf, type Edition } from "./format";

// Alt keeps a printing by asking for that printing and rejecting the other one.
// A plain name-and-number search ranks Unlimited next to 1st edition.
export function editionClause(edition: Edition | null): string {
  if (edition === "first") return "1st -unlimited -unl";
  if (edition === "unlimited") return "Unlimited -1st -shadowless";
  if (edition === "shadowless") return "shadowless -unlimited -unl";
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
  return /\breverse\b/i.test(title);
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
  if (edition === "shadowless" && (!saysShadowless(title) || saysUnlimited(title))) return false;
  if (finish === "reverse" && !saysReverse(title)) return false;
  if (finish === "holo" && (saysReverse(title) || saysNonHolo(title))) return false;
  if (finish === "normal" && (saysReverse(title) || saysHolo(title))) return false;
  return true;
}
