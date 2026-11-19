import assert from "node:assert/strict";
import { test } from "node:test";
import { applyBaseEditions, baseEditionRows } from "./base-editions";
import { resolveActive } from "./facts";
import { editionOf, variantLabel } from "./format";
import type { VariantQuote } from "./types";

function variant(key: string, market: number | null = 10): VariantQuote {
  return { key, label: key, market, low: null, mid: null, high: null, currency: "USD" };
}

test("base charizard asks which printing, including 1st edition shadowless and unlimited", () => {
  const rows = [
    ...baseEditionRows(
      [
        { productId: 42382, name: "Charizard", number: "004/102" },
        { productId: 657516, name: "Charizard (Black Dot Error)", number: "004/102" },
      ],
      [
        { productId: 42382, subTypeName: "Holofoil", marketPrice: 1001.05, lowPrice: 499.99, midPrice: 675.1, highPrice: 3499.1 },
        { productId: 657516, subTypeName: "Holofoil", marketPrice: 700, lowPrice: 699, midPrice: 799, highPrice: 998 },
      ],
      "base",
    ),
    ...baseEditionRows(
      [{ productId: 106999, name: "Charizard", number: "004/102" }],
      [
        { productId: 106999, subTypeName: "1st Edition Holofoil", marketPrice: null, lowPrice: 100000, midPrice: 100000, highPrice: 100000 },
        { productId: 106999, subTypeName: "Unlimited Holofoil", marketPrice: 2172.24, lowPrice: 3187, midPrice: 5750, highPrice: 10000 },
      ],
      "shadowless",
    ),
  ];
  const next = applyBaseEditions([variant("holofoil", 1001.05)], rows);
  assert.ok(next);
  assert.deepEqual(
    next.map((entry) => entry.key),
    ["unlimitedHolofoil", "firstEditionShadowlessHolofoil", "unlimitedShadowlessHolofoil"],
  );
  assert.equal(next.find((entry) => entry.key === "firstEditionShadowlessHolofoil")?.market, null);
  assert.equal(next.find((entry) => entry.key === "unlimitedHolofoil")?.market, 1001.05);
  assert.equal(next.find((entry) => entry.key === "unlimitedShadowlessHolofoil")?.productUrl, "https://www.tcgplayer.com/product/106999");
  assert.equal(rows.some((row) => row.productId === 657516), false);
  assert.equal(editionOf("firstEditionShadowlessHolofoil"), "first");
  assert.equal(editionOf("unlimitedShadowlessHolofoil"), "shadowless");
  assert.equal(editionOf("unlimitedHolofoil"), "unlimited");
  assert.equal(variantLabel("firstEditionShadowlessHolofoil"), "1st edition shadowless");
  assert.equal(variantLabel("unlimitedShadowlessHolofoil"), "Unlimited shadowless");

  const open = resolveActive({ finish: null, modifiers: [], variants: next, pickedKey: null, loaded: true });
  assert.equal(open.needsPick, true);
  assert.equal(open.key, null);
  const first = resolveActive({ finish: "holo", modifiers: ["first", "holo"], variants: next, pickedKey: null, loaded: true });
  assert.equal(first.needsPick, false);
  assert.equal(first.key, "firstEditionShadowlessHolofoil");
});

test("a feed that already names the edition is left alone", () => {
  const kept = applyBaseEditions([variant("1stEditionHolofoil", 600), variant("unlimitedHolofoil", 180)], []);
  assert.equal(kept, null);
});
