import assert from "node:assert/strict";
import { test } from "node:test";
import { deskShareFrom, deskShareHref } from "./share";

test("a pulled card and its printing share one address", () => {
  const href = deskShareHref("gardevoir emerald", "ex9-4", "reverse-holo");
  assert.equal(href, "/?q=gardevoir+emerald&card=ex9-4&printing=reverse-holo");
  assert.deepEqual(deskShareFrom(href.slice(1)), { q: "gardevoir emerald", card: "ex9-4", printing: "reverse-holo" });
});

test("a search without a printing omits that part", () => {
  assert.equal(deskShareHref("gardevoir emerald"), "/?q=gardevoir+emerald");
  assert.deepEqual(deskShareFrom("?q=gardevoir+emerald"), { q: "gardevoir emerald", card: null, printing: null });
});
