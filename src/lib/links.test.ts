import assert from "node:assert/strict";
import { test } from "node:test";
import { ebaySearchUrl, searchPhrase, tcgplayerProductUrl, tcgplayerSearchUrl } from "./links";
import type { PublicCard } from "./types";

const umbreon = {
  name: "Umbreon",
  setName: "BW Black Star Promos",
  number: "BW93",
  printedTotal: 101,
} as PublicCard;

test("Rayquaza ex 039 searches as the printed promo number", () => {
  const rayquaza = {
    name: "Rayquaza ex",
    setId: "np",
    setName: "Nintendo Black Star Promos",
    number: "39",
    printedTotal: 40,
  } as PublicCard;
  const href = tcgplayerSearchUrl(rayquaza);
  assert.equal(new URL(href).searchParams.get("q"), "Rayquaza ex 039");
  assert.equal(searchPhrase(rayquaza), "Pokemon Rayquaza ex 039");
});

test("a TCGplayer product link opens that printing in Near Mint", () => {
  const href = tcgplayerProductUrl("https://www.tcgplayer.com/product/85633/pokemon-ex-emerald-gardevoir", "reverseHolofoil");
  assert.equal(href, "https://www.tcgplayer.com/product/85633/pokemon-ex-emerald-gardevoir?Printing=Reverse+Holofoil&page=1&Condition=Near+Mint");
  assert.equal(tcgplayerProductUrl("https://www.tcgplayer.com/search/pokemon/product?q=Gardevoir", "holofoil"), "https://www.tcgplayer.com/search/pokemon/product?q=Gardevoir");
});

test("a graded eBay search uses Graded, Grade, and Professional Grader", () => {
  const href = ebaySearchUrl(umbreon, "auction", { company: "PSA", grade: "7" });
  const url = new URL(href);
  assert.equal(url.searchParams.get("Graded"), "Yes");
  assert.equal(url.searchParams.get("Grade"), "7");
  assert.equal(url.searchParams.get("LH_Auction"), "1");
  assert.equal(url.searchParams.get("Professional%20Grader"), "Professional%20Sports%20Authenticator%20%28PSA%29");
  assert.equal(href.includes("Professional%2520Grader=Professional%2520Sports%2520Authenticator%2520%2528PSA%2529"), true);
  const keywords = url.searchParams.get("_nkw") ?? "";
  assert.equal(keywords.includes("PSA"), false);
  assert.equal(keywords.includes("Umbreon"), true);
  assert.equal(keywords.includes("BW93/101"), true);
});
