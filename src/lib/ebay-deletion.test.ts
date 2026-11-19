import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { challengeResponse } from "./ebay-deletion";

test("the challenge hash is the three values in eBay's order", () => {
  const hash = challengeResponse("123", "token-token-token-token-token-token", "https://charsi-app.vercel.app/api/ebay/account-deletion");
  const expected = createHash("sha256")
    .update("123")
    .update("token-token-token-token-token-token")
    .update("https://charsi-app.vercel.app/api/ebay/account-deletion")
    .digest("hex");
  assert.equal(hash, expected);
  assert.equal(hash.length, 64);
});
