import assert from "node:assert/strict";
import { test } from "node:test";
import { listingAmount } from "./ebay";

test("an auction with bids uses the current bid when the asking price is empty", () => {
  const amount = listingAmount({
    price: null,
    currentBidPrice: { value: "280.00", currency: "USD" },
  });
  assert.deepEqual(amount, { amount: 280, currency: "USD" });
});

test("a Buy It Now price wins over a current bid", () => {
  const amount = listingAmount({
    price: { value: "42.50", currency: "USD" },
    currentBidPrice: { value: "10.00", currency: "USD" },
  });
  assert.deepEqual(amount, { amount: 42.5, currency: "USD" });
});

test("a converted auction keeps the marketplace currency on the bid", () => {
  const amount = listingAmount({
    currentBidPrice: { value: "132.09", currency: "USD", convertedFromValue: "100.00", convertedFromCurrency: "GBP" },
  });
  assert.deepEqual(amount, { amount: 132.09, currency: "USD" });
});
