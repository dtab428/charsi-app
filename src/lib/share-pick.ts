import { mergePrintings, printingFamily } from "./facts";
import { findPrinting } from "./printing";
import type { VariantQuote } from "./types";

type FamilyCard = { id: string; setId: string; name: string };

export type PickLine<T extends FamilyCard = FamilyCard> = {
  key: string;
  card: T | null;
  alternatives: T[];
  picked: string | null;
  status: string;
  included: boolean;
};

// A shared address can name one card and one printing. Two identical lines stay
// independent: the address restores the first line, and a click restores only
// the line it names.
export function applySharedPrinting<T extends PickLine>(
  items: T[],
  quotes: Record<string, { variants: VariantQuote[] } | null | undefined>,
  wanted: { card: string; printing: string; line: string | null },
): { items: T[]; line: string | null } {
  const index = wanted.line
    ? items.findIndex((item) => item.key === wanted.line)
    : items.findIndex((item) => item.card != null && printingFamily(item.card, item.alternatives).some((card) => card.id === wanted.card));
  if (index < 0) return { items, line: wanted.line };
  const item = items[index];
  if (!item.card) return { items, line: wanted.line };
  const family = printingFamily(item.card, item.alternatives);
  const owner = family.find((card) => card.id === wanted.card);
  if (!owner) return { items, line: wanted.line };
  const variants = mergePrintings(family.map((member) => ({ cardId: member.id, variants: quotes[member.id]?.variants ?? [] })));
  const hit = findPrinting(variants, wanted.printing);
  if (!hit) return { items, line: wanted.line };
  const line = wanted.line ?? item.key;
  if (item.card.id === owner.id && item.picked === hit.key) return { items, line };
  const outside = item.alternatives.filter((alt) => !family.some((member) => member.id === alt.id));
  const next = items.slice();
  next[index] = {
    ...item,
    card: owner,
    alternatives: [...family.filter((member) => member.id !== owner.id), ...outside],
    picked: hit.key,
    status: outside.length === 0 ? "matched" : item.status,
    included: true,
  };
  return { items: next, line };
}
