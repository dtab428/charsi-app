import { keptAfterChoice, mergePrintings, printingFamily } from "./facts";
import { findPrinting } from "./printing";
import type { PublicCard, VariantQuote } from "./types";

export type PickLine = {
  card: PublicCard | null;
  alternatives: PublicCard[];
  picked: string | null;
  status: string;
  included: boolean;
};

type Quotes = Record<string, { variants: VariantQuote[] } | null | undefined>;

// A shared address names the card a line settled on. Only the cards that line
// already matched (its own card and alternatives) can be restored.
export function withSharedCard<T extends PickLine>(item: T, cardId: string | null): T {
  if (!item.card || !cardId || item.card.id === cardId) return item;
  const chosen = item.alternatives.find((alt) => alt.id === cardId);
  if (!chosen) return item;
  return { ...item, card: chosen, status: "matched", picked: null, included: true, alternatives: keptAfterChoice(item.card, item.alternatives, chosen) };
}

// The printing is restored once every card in the line's family has a quote,
// because the printing names come from those quotes.
export function withSharedPrinting<T extends PickLine>(item: T, printing: string, quotes: Quotes): { item: T; done: boolean } {
  if (!item.card) return { item, done: true };
  const family = printingFamily(item.card, item.alternatives);
  if (!family.every((member) => quotes[member.id] !== undefined)) return { item, done: false };
  const variants = mergePrintings(family.map((member) => ({ cardId: member.id, variants: quotes[member.id]?.variants ?? [] })));
  const hit = findPrinting(variants, printing);
  if (!hit) return { item, done: true };
  const owner = family.find((member) => member.id === hit.cardId) ?? item.card;
  if (item.card.id === owner.id && item.picked === hit.key) return { item, done: true };
  const outside = item.alternatives.filter((alt) => !family.some((member) => member.id === alt.id));
  return {
    item: {
      ...item,
      card: owner,
      alternatives: [...family.filter((member) => member.id !== owner.id), ...outside],
      picked: hit.key,
      status: outside.length === 0 ? "matched" : item.status,
      included: true,
    },
    done: true,
  };
}
