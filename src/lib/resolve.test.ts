import assert from "node:assert/strict";
import { test } from "node:test";
import { getCatalog } from "./catalog";
import { parseList } from "./parse";
import { resolveText } from "./resolve";

const catalog = getCatalog();

function one(text: string) {
  const [item] = resolveText(catalog, text);
  assert.ok(item, text);
  return item;
}

test("splits commas, lines, quantities, and list markers", () => {
  const lines = parseList("2x Rayquaza ex 039, Dragonite TRR\n1. Charizard base set 4");
  assert.equal(lines.length, 3);
  assert.equal(lines[0]?.quantity, 2);
  assert.equal(lines[0]?.number, "039");
  assert.equal(lines[2]?.tokens.includes("charizard"), true);
});

test("finds Dark Dragonite from a short stamped ask", () => {
  const item = one("Dragonite TRR stamp");
  assert.equal(item.card?.id, "ex7-15");
  assert.equal(item.status, "matched");
  assert.ok(item.notes.some((note) => note.toLowerCase().includes("stamp")));
});

test("corrects a charizard typo with set and number", () => {
  const item = one("charzard base set 4");
  assert.equal(item.card?.id, "base1-4", JSON.stringify(item.corrections));
  assert.equal(item.status, "matched");
  assert.ok(item.corrections.some((correction) => correction.includes("charizard")));
});

test("keeps quantity on Umbreon VMAX 215", () => {
  const item = one("2x Umbreon VMAX 215");
  assert.equal(item.quantity, 2);
  assert.equal(item.card?.id, "swsh7-215");
});

test("reads Mew ex 151 as the card numbered 151 in that set", () => {
  const item = one("Mew ex 151");
  assert.equal(item.card?.id, "sv3pt5-151");
});

test("reads Rayquaza ex 039", () => {
  const item = one("Rayquaza ex 039");
  assert.equal(item.card?.id, "np-39");
});

test("asks for a pick when several Pikachu 025 printings fit", () => {
  const item = one("Pikachu 025");
  assert.equal(item.status, "ambiguous");
  assert.equal(item.card?.name, "Pikachu");
  assert.ok(item.alternatives.length >= 1);
});

test("corrects a misspelled set and still offers the printings", () => {
  const item = one("umbreon skyridg");
  assert.equal(item.status, "ambiguous");
  assert.equal(item.card?.setId, "ecard3");
  assert.ok(item.corrections.some((correction) => correction.includes("skyridge")));
  const ids = [item.card?.id, ...item.alternatives.map((alt) => alt.id)].sort();
  assert.deepEqual(ids, ["ecard3-32", "ecard3-H30"]);
});

test("leaves a nonsense line unmatched", () => {
  const item = one("blorbo zzz 999");
  assert.equal(item.status, "unmatched");
  assert.equal(item.card, null);
});

test("resolves a set code and number with no name", () => {
  const item = one("TRR 15");
  assert.equal(item.card?.id, "ex7-15");
});

test("reads grader, grade, and reverse holo from a typed line", () => {
  const item = one("PSA 9 Dragonite TRR reverse holo");
  assert.equal(item.card?.id, "ex7-15");
  assert.deepEqual(item.grading, { company: "PSA", grade: "9" });
  assert.equal(item.finish, "reverse");
});

test("reads TAG with a grade and non holo", () => {
  const item = one("TAG 9 Dragonite TRR non holo");
  assert.equal(item.card?.id, "ex7-15");
  assert.deepEqual(item.grading, { company: "TAG", grade: "9" });
  assert.equal(item.finish, "normal");
});

test("a bare stamp is read as reverse and says so", () => {
  const item = one("Dragonite TRR stamp");
  assert.equal(item.finish, "reverse");
  assert.equal(item.stampRead, true);
});

test("keeps both Fossil Dragonites when the edition and finish are unstated", () => {
  const item = one("dragonite fossil");
  assert.equal(item.card?.setId, "base3");
  const ids = [item.card?.id, ...item.alternatives.map((alt) => alt.id)].sort();
  assert.deepEqual(ids, ["base3-19", "base3-4"]);
  assert.equal(item.finish, null);
});

test("leaves the printing open when it is not stated", () => {
  const item = one("Dragonite TRR");
  assert.equal(item.finish, null);
  assert.equal(item.grading, null);
});

test("include all expands a set, a finish, and a name", () => {
  const holos = resolveText(catalog, "include all the holo cards from team rocket returns");
  assert.ok(holos.length > 5);
  assert.ok(holos.every((item) => item.card?.setId === holos[0]?.card?.setId));
  assert.ok(holos.every((item) => /holo/i.test(item.card?.rarity ?? "")));
  assert.equal(holos[0]?.finish, "holo");

  const stamps = resolveText(catalog, "include all reverse holo stamps for ex emerald set");
  assert.ok(stamps.length > 20);
  assert.ok(stamps.every((item) => item.card?.setId === "ex9"));
  assert.equal(stamps[0]?.finish, "reverse");
  assert.equal(stamps[0]?.stampRead, true);

  const groudon = resolveText(catalog, "include all groudon cards");
  assert.ok(groudon.length > 5);
  assert.ok(groudon.length <= 80);
  assert.ok(groudon.every((item) => item.card?.name.toLowerCase().includes("groudon")));
});

test("a one-letter slip in Dragonite does not offer Dragonair", () => {
  const item = one("trr dragonit");
  assert.equal(item.card?.id, "ex7-15");
  assert.equal(item.card?.name, "Dark Dragonite");
  assert.equal(item.alternatives.some((alt) => alt.name.includes("Dragonair")), false);
  assert.ok(item.corrections.some((correction) => correction.includes("dragonit")));
});

test("a typo in a name still finds a card that has the same name", () => {
  const item = one("dark dragonit");
  assert.equal(item.card?.name, "Dark Dragonite");
  assert.notEqual(item.status, "unmatched");
});

test("Tag Team is not a grader and 9.5 stays a grade", () => {
  const team = one("Pikachu & Zekrom Tag Team GX");
  assert.equal(team.grading, null);
  const half = parseList("BGS 9.5 Charizard base set 4")[0];
  assert.deepEqual(half?.grading, { company: "BGS", grade: "9.5" });
});
