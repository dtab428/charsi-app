import assert from "node:assert/strict";
import { test } from "node:test";
import { withSharedCard, withSharedPrinting, type PickLine } from "./share-pick";
import type { PublicCard, VariantQuote } from "./types";

function card(id: string, setId = "ex9"): PublicCard {
  return { id, setId, name: "Gardevoir" } as PublicCard;
}

function variant(key: string): VariantQuote {
  return { key, label: key, market: 10, low: null, mid: null, high: null, currency: "USD" };
}

function line(picked: string | null = null): PickLine {
  return { card: card("ex9-4"), alternatives: [], picked, status: "matched", included: true };
}

const quotes = { "ex9-4": { variants: [variant("normal"), variant("holofoil"), variant("reverseHolofoil")] } };

test("a printing from the address lands on the line it was written for", () => {
  const items = [line("holofoil"), line()];
  const restored = withSharedPrinting(items[1], "reverse-holo", quotes);
  assert.equal(restored.done, true);
  assert.equal(restored.item.picked, "reverseHolofoil");
  assert.equal(items[0].picked, "holofoil");
  assert.equal(items[1].picked, null);
});

test("a printing waits until the line has its quotes", () => {
  const waiting = withSharedPrinting(line(), "holo", {});
  assert.equal(waiting.done, false);
  assert.equal(waiting.item.picked, null);
});

test("a printing the card does not have is dropped", () => {
  const missing = withSharedPrinting(line(), "first-edition-holo", quotes);
  assert.equal(missing.done, true);
  assert.equal(missing.item.picked, null);
});

test("a shared card is restored from the line's own alternatives", () => {
  const item: PickLine = { card: card("sk-1", "ex2"), alternatives: [card("ex9-4")], picked: null, status: "ambiguous", included: true };
  const chosen = withSharedCard(item, "ex9-4");
  assert.equal(chosen.card?.id, "ex9-4");
  assert.equal(chosen.status, "matched");
  assert.equal(withSharedCard(item, "unknown-1").card?.id, "sk-1");
});
