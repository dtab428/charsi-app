import assert from "node:assert/strict";
import test from "node:test";
import { collectorNumber, lineFromOcr, repairLine } from "./ocr-line";

test("builds a matcher line from a name band and a number band", () => {
  const line = lineFromOcr("Evolves from Charmeleon\nCharizard\n120 HP", "4/102");
  assert.equal(line, "Charizard 4");
});

test("reads a collector number when OCR confuses O and I", () => {
  assert.equal(collectorNumber("Illus. Mitsuhiro Arita  O4/I02"), "4");
});

test("keeps a lettered collector number", () => {
  assert.equal(collectorNumber("TG15/TG30"), "TG15");
});

test("drops OCR crumbs and finishes a clipped name", () => {
  const line = repairLine("Yeo Charizard ee 4", (token) => token === "charizard", (token) => (token === "dragoni" ? "dragonite" : null));
  assert.equal(line, "charizard 4");
  assert.equal(repairLine("dark dragoni 15", (token) => token === "dark", (token) => (token === "dragoni" ? "dragonite" : null)), "dark dragonite 15");
});
