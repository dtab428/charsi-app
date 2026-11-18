import assert from "node:assert/strict";
import { test } from "node:test";
import { applySharedPrinting, type PickLine } from "./share-pick";
import type { VariantQuote } from "./types";

function variant(key: string): VariantQuote {
  return { key, label: key, market: 10, low: null, mid: null, high: null, currency: "USD" };
}

function line(key: string, picked: string | null = null): PickLine {
  return {
    key,
    card: { id: "ex9-4", setId: "ex9", name: "Gardevoir" },
    alternatives: [],
    picked,
    status: "matched",
    included: true,
  };
}

const quotes = { "ex9-4": { variants: [variant("normal"), variant("holofoil"), variant("reverseHolofoil")] } };

test("a click on one of two identical lines leaves the other line alone", () => {
  const items = [line("line-a", "holofoil"), line("line-b")];
  const applied = applySharedPrinting(items, quotes, { card: "ex9-4", printing: "reverse-holo", line: "line-b" });
  assert.equal(applied.items[0].picked, "holofoil");
  assert.equal(applied.items[1].picked, "reverseHolofoil");
  assert.equal(applied.line, "line-b");
  assert.equal(items[1].picked, null);
});

test("an opened address fills only the first matching line", () => {
  const applied = applySharedPrinting([line("line-a"), line("line-b")], quotes, { card: "ex9-4", printing: "holofoil", line: null });
  assert.equal(applied.items[0].picked, "holofoil");
  assert.equal(applied.items[1].picked, null);
  assert.equal(applied.line, "line-a");
});

test("a later click does not rewrite the line that was restored from the address", () => {
  const restored = applySharedPrinting([line("line-a"), line("line-b")], quotes, { card: "ex9-4", printing: "holofoil", line: null });
  const clicked = applySharedPrinting(restored.items, quotes, { card: "ex9-4", printing: "normal", line: "line-b" });
  assert.equal(clicked.items[0].picked, "holofoil");
  assert.equal(clicked.items[1].picked, "normal");
});
