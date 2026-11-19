import assert from "node:assert/strict";
import { test } from "node:test";
import { finishTwins, holoScan, keptAfterChoice, mergePrintings, printingFamily, resolveActive, shownPicture, withFinishFlags } from "./facts";
import { preferPricedVariants } from "./prices";
import type { PriceQuote, PublicCard } from "./types";
import { finishOf, reverseStamp, variantLabel, withoutGenericEditions } from "./format";
import { stampLogo } from "./stamp-art";
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

test("an illustration rare stays its own card, and a holo stays a printing of the non-holo", () => {
  const regular = { id: "me6-84", setId: "me6", name: "Mega Rayquaza ex", rarity: "Double Rare" };
  const sir = { id: "me6-138", setId: "me6", name: "Mega Rayquaza ex", rarity: "Special Illustration Rare" };
  const hyper = { id: "me6-141", setId: "me6", name: "Mega Rayquaza ex", rarity: "Mega Hyper Rare" };
  assert.deepEqual(printingFamily(regular, [sir, hyper]).map((card) => card.id), ["me6-84"]);
  assert.equal(finishTwins("Double Rare", "Special Illustration Rare"), false);
  const plain = { id: "ecard3-32", setId: "ecard3", name: "Umbreon", rarity: "Rare" };
  const holo = { id: "ecard3-H30", setId: "ecard3", name: "Umbreon", rarity: "Rare Holo" };
  assert.deepEqual(printingFamily(plain, [holo]).map((card) => card.id), ["ecard3-32", "ecard3-H30"]);
});

test("a holofoil copy saved on the non-holo card uses the holo scan", () => {
  const plain = { id: "ecard3-32", rarity: "Rare", large: "moon" };
  const holo = { id: "ecard3-H30", rarity: "Rare Holo", large: "crystal" };
  assert.equal(holoScan(plain, "holofoil", [plain, holo]), "crystal");
  assert.equal(holoScan(holo, "holo", [plain, holo]), "crystal");
  assert.equal(holoScan(plain, "normal", [plain, holo]), "moon");
});

test("a holo-only price does not grow a fake non-holo", () => {
  // Roaring Skies M Rayquaza-EX 61 is holofoil only. TCGdex still flags it normal:true.
  const priced = [variant("holofoil", 144.13)];
  const kept = withFinishFlags(priced, { normal: true, holo: false, reverse: false }, null);
  assert.deepEqual(kept.map((entry) => entry.key), ["holofoil"]);
  const cap = withFinishFlags([variant("normal", 1), variant("reverseHolofoil", 2)], { normal: true, holo: false, reverse: false }, null);
  assert.deepEqual(cap.map((entry) => entry.key), ["normal", "reverseHolofoil"]);
});

test("unlimited covers the stamp on the hires scan and 1st edition keeps it", () => {
  const small = "https://images.pokemontcg.io/base3/4.png";
  const large = "https://images.pokemontcg.io/base3/4_hires.png";
  const unlimited = variant("unlimited");
  unlimited.image = large;
  const first = variant("1stEdition");
  first.image = small;
  assert.equal(shownPicture([unlimited, first], "unlimited", "normal", small, large), `/api/image?src=${encodeURIComponent(large)}&cover=stamp`);
  assert.equal(shownPicture([unlimited, first], "1stEdition", "normal", small, large), large);
  assert.equal(shownPicture([unlimited], "unlimited", "normal", "https://images.example/plain.png", ""), "https://images.example/plain.png");
});

test("a holo printing uses the hires scan when the variant has no photo of its own", () => {
  const flat = "https://images.example/small.png";
  const holo = "https://images.example/hires.png";
  const variants = [variant("normal"), variant("holofoil"), variant("reverseHolofoil")];
  assert.equal(shownPicture(variants, "holofoil", "holo", flat, holo), holo);
  assert.equal(shownPicture(variants, "normal", "normal", flat, holo), flat);
  assert.equal(shownPicture(variants, "reverseHolofoil", "reverse", flat, holo), holo);
  variants[1].image = "https://images.example/own.png";
  assert.equal(shownPicture(variants, "holofoil", "holo", flat, holo), "https://images.example/own.png");
});

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
  assert.equal(stampLogo("ex7"), "/stamps/ex7.png");
  assert.equal(stampLogo("ecard3"), null);
});

test("a modern card with three finishes still asks, and a stated reverse does not", () => {
  const variants = [variant("normal"), variant("holofoil"), variant("reverseHolofoil")];
  const open = resolveActive({ finish: null, modifiers: [], variants, pickedKey: null, loaded: true });
  assert.equal(open.needsPick, true);
  const reverse = resolveActive({ finish: "reverse", modifiers: ["reverse"], variants, pickedKey: null, loaded: true });
  assert.equal(reverse.needsPick, false);
  assert.equal(reverse.key, "reverseHolofoil");
});
