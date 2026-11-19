import assert from "node:assert/strict";
import { test } from "node:test";
import { editionClause, finishClause, listingMatchesPrinting } from "./listing-match";

test("1st edition keeps a stamped title and drops Unlimited", () => {
  assert.equal(listingMatchesPrinting("Pokemon Fossil 1st Edition Dragonite 4/62 PSA 9", "1stEditionHolofoil"), true);
  assert.equal(listingMatchesPrinting("Pokemon Dragonite 4/62 Fossil Holo Rare Unlimited 1999", "1stEditionHolofoil"), false);
  assert.equal(listingMatchesPrinting("1999 WOTC Pokemon FOSSIL DRAGONITE HOLO 4/62 RARE", "1stEditionHolofoil"), false);
});

test("Unlimited keeps an unlimited title and drops a 1st edition title", () => {
  assert.equal(listingMatchesPrinting("Dragonite Holo Fossil Unlimited 4/62", "unlimitedHolofoil"), true);
  assert.equal(listingMatchesPrinting("Dragonite 4/62 1st Edition Fossil Holo", "unlimitedHolofoil"), false);
  assert.equal(listingMatchesPrinting("Charizard 4/102 1st Edition Shadowless", "unlimitedHolofoil"), false);
});

test("the search clause names one printing and rejects the other", () => {
  assert.equal(editionClause("first"), "1st -unlimited -unl");
  assert.equal(editionClause("unlimited"), "Unlimited -1st -shadowless");
  assert.equal(editionClause("shadowless"), "shadowless -1st -first");
  assert.equal(editionClause(null), "");
});

test("a reverse holo keeps a reverse title and drops a plain Rare Holo", () => {
  const regular = "Espeon δ 4/113 Pokemon Delta Species 2005 Rare Holo Card LP";
  const reverse = "Espeon δ 4/113 Delta Species Reverse Holo";
  const rev = "Espeon 4/113 Delta Species Rev Holo";
  assert.equal(listingMatchesPrinting(regular, "reverseHolofoil"), false);
  assert.equal(listingMatchesPrinting(reverse, "reverseHolofoil"), true);
  assert.equal(listingMatchesPrinting(rev, "reverseHolofoil"), true);
  assert.equal(listingMatchesPrinting(regular, "holofoil"), true);
  assert.equal(listingMatchesPrinting(reverse, "holofoil"), false);
  assert.equal(listingMatchesPrinting("Pokemon Card Espeon δ Delta Species Stamped 4/113", "holofoil"), false);
  assert.equal(listingMatchesPrinting("Pokemon Card Espeon δ Delta Species Stamped 4/113", "reverseHolofoil"), true);
  assert.equal(finishClause("reverse"), "reverse");
  assert.equal(finishClause("holo"), "-reverse");
});

test("base charizard shadowless keeps unlimited shadowless and drops the 1st edition stamp", () => {
  assert.equal(listingMatchesPrinting("Charizard 4/102 Unlimited Shadowless Holo", "unlimitedShadowlessHolofoil"), true);
  assert.equal(listingMatchesPrinting("Charizard 4/102 1st Edition Shadowless", "unlimitedShadowlessHolofoil"), false);
  assert.equal(listingMatchesPrinting("Charizard 4/102 1st Edition Shadowless Holo", "firstEditionShadowlessHolofoil"), true);
  assert.equal(listingMatchesPrinting("Charizard 4/102 Unlimited Shadowless", "unlimitedHolofoil"), false);
  assert.equal(listingMatchesPrinting("Charizard 4/102 Unlimited Holo", "unlimitedHolofoil"), true);
});
