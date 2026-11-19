import assert from "node:assert/strict";
import { test } from "node:test";
import { convert, type FxTable } from "./fx";

const table: FxTable = { base: "USD", date: "2026-11-18", rates: { EUR: 0.92, GBP: 0.78, JPY: 155 } };

test("a dollar stays a dollar", () => {
  assert.equal(convert(39.95, "USD", "USD", table), 39.95);
});

test("euros and pounds convert through the dollar rate", () => {
  const dollars = convert(92, "EUR", "USD", table);
  assert.ok(dollars != null && Math.abs(dollars - 100) < 0.001);
  const pounds = convert(100, "USD", "GBP", table);
  assert.ok(pounds != null && Math.abs(pounds - 78) < 0.001);
  const cross = convert(92, "EUR", "GBP", table);
  assert.ok(cross != null && Math.abs(cross - 78) < 0.001);
});

test("a missing rate is left unconverted", () => {
  assert.equal(convert(10, "EUR", "GBP", null), null);
  assert.equal(convert(10, "CHF", "USD", table), null);
});
