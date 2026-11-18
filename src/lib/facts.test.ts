import assert from "node:assert/strict";
import { test } from "node:test";
import { mergePrintings, resolveActive } from "./facts";
import { finishOf, variantLabel, withoutGenericEditions } from "./format";
import type { VariantQuote } from "./types";

function variant(key: string, market: number | null = 10): VariantQuote {
  return { key, label: key, market, low: null, mid: null, high: null, currency: "USD" };
}

const fossil = [
  variant("1stEditionHolofoil", 629),
  variant("unlimitedHolofoil", 188),
  variant("holofoil", 200),
  variant("1stEdition", 104),
  variant("unlimited", 40),
  variant("normal"),
];

test("edition printings stay distinct and the generic holo is dropped", () => {
  const kept = withoutGenericEditions(fossil).map((entry) => entry.key);
  assert.deepEqual(kept, ["1stEditionHolofoil", "unlimitedHolofoil", "1stEdition", "unlimited"]);
  assert.equal(finishOf("1stEdition"), "normal");
  assert.equal(finishOf("1stEditionHolofoil"), "holo");
  assert.equal(variantLabel("1stEdition"), "1st edition non-holo");
  assert.equal(variantLabel("unlimitedHolofoil"), "Unlimited holo");
});

test("fossil dragonite asks before it shows a price", () => {
  const merged = mergePrintings([
    { cardId: "base3-4", variants: fossil.slice(0, 3) },
    { cardId: "base3-19", variants: fossil.slice(3) },
  ]);
  const open = resolveActive({ finish: null, modifiers: [], variants: merged, pickedKey: null, loaded: true });
  assert.equal(open.needsPick, true);
  assert.equal(open.key, null);

  const holoOnly = resolveActive({ finish: "holo", modifiers: ["holo"], variants: merged, pickedKey: null, loaded: true });
  assert.equal(holoOnly.needsPick, true);

  const exact = resolveActive({ finish: "holo", modifiers: ["first", "holo"], variants: merged, pickedKey: null, loaded: true });
  assert.equal(exact.needsPick, false);
  assert.equal(exact.key, "1stEditionHolofoil");
  assert.equal(exact.cardId, "base3-4");

  const nonHolo = resolveActive({ finish: "normal", modifiers: ["first", "nonholo"], variants: merged, pickedKey: null, loaded: true });
  assert.equal(nonHolo.key, "1stEdition");
  assert.equal(nonHolo.cardId, "base3-19");
});

test("a modern card with three finishes still asks, and a stated reverse does not", () => {
  const variants = [variant("normal"), variant("holofoil"), variant("reverseHolofoil")];
  const open = resolveActive({ finish: null, modifiers: [], variants, pickedKey: null, loaded: true });
  assert.equal(open.needsPick, true);
  const reverse = resolveActive({ finish: "reverse", modifiers: ["reverse"], variants, pickedKey: null, loaded: true });
  assert.equal(reverse.needsPick, false);
  assert.equal(reverse.key, "reverseHolofoil");
});
