import assert from "node:assert/strict";
import { test } from "node:test";
import { ebaySearchUrl } from "./links";
import type { PublicCard } from "./types";

const umbreon = {
  name: "Umbreon",
  setName: "BW Black Star Promos",
  number: "BW93",
  printedTotal: 101,
} as PublicCard;

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
