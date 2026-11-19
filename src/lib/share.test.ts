import assert from "node:assert/strict";
import { test } from "node:test";
import { deskShareFrom, deskShareHref, EMPTY_LINE } from "./share";

test("every line and filter state shares one address", () => {
  const href = deskShareHref(
    "gardevoir emerald\ngardevoir emerald",
    [
      { ...EMPTY_LINE, card: "ex9-4", printing: "normal" },
      { ...EMPTY_LINE, card: "ex9-4", printing: "reverse-holo", condition: "PSA", grade: "9" },
    ],
    { source: "ebay", condition: "PSA", grade: "7" },
  );
  assert.equal(href, "/?q=gardevoir+emerald%0Agardevoir+emerald&i=ex9-4_normal&i=ex9-4_reverse-holo_PSA_9&src=ebay&cond=PSA&grade=7");
  const back = deskShareFrom(href.slice(1));
  assert.equal(back?.q, "gardevoir emerald\ngardevoir emerald");
  assert.deepEqual(back?.lines[1], { ...EMPTY_LINE, card: "ex9-4", printing: "reverse-holo", condition: "PSA", grade: "9" });
  assert.deepEqual(back?.filters, { source: "ebay", condition: "PSA", grade: "7", wear: null });
});

test("a search without choices omits them", () => {
  assert.equal(deskShareHref("gardevoir emerald"), "/?q=gardevoir+emerald");
  const back = deskShareFrom("?q=gardevoir+emerald");
  assert.deepEqual(back, { q: "gardevoir emerald", lines: [], filters: { source: null, condition: null, grade: null, wear: null } });
});

test("a removed line and a switched-off line keep their place", () => {
  const href = deskShareHref("a, b, c", [{ ...EMPTY_LINE, removed: true }, { ...EMPTY_LINE, card: "ex9-4", off: true }, EMPTY_LINE]);
  assert.equal(href, "/?q=a%2C+b%2C+c&i=-&i=ex9-4____off");
  const back = deskShareFrom(href.slice(1));
  assert.equal(back?.lines[0].removed, true);
  assert.equal(back?.lines[1].off, true);
});

test("earlier addresses with card and printing still open", () => {
  const back = deskShareFrom("?q=gardevoir+emerald&card=ex9-4&printing=reverse-holo");
  assert.deepEqual(back?.lines, [{ ...EMPTY_LINE, card: "ex9-4", printing: "reverse-holo" }]);
});

test("a played raw line keeps its wear", () => {
  const href = deskShareHref("gardevoir emerald", [{ ...EMPTY_LINE, card: "ex9-4", printing: "reverse-holo", condition: "raw", wear: "LP" }], { wear: "LP" });
  assert.equal(href, "/?q=gardevoir+emerald&i=ex9-4_reverse-holo_raw__LP&wear=LP");
  const back = deskShareFrom(href.slice(1));
  assert.equal(back?.lines[0]?.wear, "LP");
  assert.equal(back?.filters.wear, "LP");
});

test("an explicit raw view on one line survives a graded filter", () => {
  const href = deskShareHref("gardevoir emerald", [{ ...EMPTY_LINE, card: "ex9-4", condition: "raw" }], { condition: "PSA", grade: "9" });
  assert.equal(href, "/?q=gardevoir+emerald&i=ex9-4__raw&cond=PSA&grade=9");
});
