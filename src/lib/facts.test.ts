import assert from "node:assert/strict";
import { test } from "node:test";
import { keptAfterChoice, mergePrintings, resolveActive } from "./facts";
import { preferPricedVariants } from "./prices";
import type { PriceQuote, PublicCard } from "./types";
import { finishOf, reverseStamp, variantLabel, withoutGenericEditions } from "./format";
import { stampPaths } from "./stamp-art";
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

test("choosing one card drops the other prompt matches and keeps its printings", () => {
  const card = (id: string, setId: string, name: string) => ({ id, setId, name }) as PublicCard;
  const promo = card("bwp-BW93", "bwp", "Umbreon");
  const evolutions = card("xy12-94", "xy12", "Umbreon");
  const fossilHolo = card("base3-4", "base3", "Dragonite");
  const fossilPlain = card("base3-19", "base3", "Dragonite");
  assert.deepEqual(keptAfterChoice(evolutions, [promo, card("smp-SM36", "smp", "Umbreon-GX")], promo).map((entry) => entry.id), []);
  assert.deepEqual(keptAfterChoice(fossilHolo, [fossilPlain, card("ex7-15", "ex7", "Dark Dragonite")], fossilPlain).map((entry) => entry.id), ["base3-4"]);
});

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

test("an unpriced non-holo gives way to a priced holo", () => {
  const blank = { source: "tcgdex", updatedAt: null, productUrl: null, variants: [variant("normal", null)], cardmarket: null, graded: [], trends: [] } satisfies PriceQuote;
  const priced = { source: "pokemon-tcg", updatedAt: null, productUrl: "https://www.tcgplayer.com/product/1", variants: [variant("holofoil", 250)], cardmarket: null, graded: [], trends: [] } satisfies PriceQuote;
  const kept = preferPricedVariants(blank, priced);
  assert.equal(kept?.variants[0]?.key, "holofoil");
  assert.equal(kept?.variants.length, 1);
  const already = preferPricedVariants(priced, blank);
  assert.equal(already?.variants[0]?.key, "holofoil");
});

test("only the stamped EX sets get a set symbol", () => {
  assert.equal(reverseStamp("ecard3"), "");
  assert.equal(reverseStamp("ex1"), "");
  assert.equal(reverseStamp("ex7"), "ex7");
  assert.equal(reverseStamp("ex16"), "ex16");
  assert.ok((stampPaths("ex7") ?? []).length > 0);
  assert.equal(stampPaths("ecard3"), null);
});

test("a modern card with three finishes still asks, and a stated reverse does not", () => {
  const variants = [variant("normal"), variant("holofoil"), variant("reverseHolofoil")];
  const open = resolveActive({ finish: null, modifiers: [], variants, pickedKey: null, loaded: true });
  assert.equal(open.needsPick, true);
  const reverse = resolveActive({ finish: "reverse", modifiers: ["reverse"], variants, pickedKey: null, loaded: true });
  assert.equal(reverse.needsPick, false);
  assert.equal(reverse.key, "reverseHolofoil");
});
