import type { IndexedCatalog } from "./catalog";
import { toPublic } from "./catalog";
import { normalize, numbersEqual, parseList, type ParsedLine } from "./parse";
import type { CatalogCard, ResolveItem } from "./types";

const MAX_LINES = 80;
const RESERVED_CODES = new Set(["ex", "hp", "v"]);
const NOISE = new Set(["pokemon", "card", "cards", "the", "a", "of", "and"]);
const STAGES = new Set(["ex", "gx", "v", "vmax", "vstar", "break", "mega"]);

type Scored = { index: number; score: number; corrections: string[] };

function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = current[0] ?? i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost);
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length] ?? max + 1;
}

function fuzzyWords(catalog: IndexedCatalog, token: string): string[] {
  if (token.length < 5 || catalog.tokenIndex.has(token)) return [];
  const max = token.length >= 8 ? 2 : 1;
  const hits: string[] = [];
  for (const word of catalog.dictionary.get(token[0] ?? "") ?? []) {
    if (Math.abs(word.length - token.length) > max) continue;
    if (levenshtein(token, word, max) <= max) hits.push(word);
    if (hits.length === 3) break;
  }
  return hits;
}

function cardTokens(card: CatalogCard): string[] {
  return card.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function hasStage(card: CatalogCard, tokens: string[], stage: string): boolean {
  if (tokens.includes(stage)) return true;
  return card.subs.some((sub) => sub.toLowerCase().replace(/[^a-z0-9]+/g, "") === stage);
}

function nameLeft(tokens: string[], consumed: Set<number>, number: string | null): string[] {
  return tokens.filter((token, index) => {
    if (consumed.has(index) || token === number) return false;
    if (NOISE.has(token) || STAGES.has(token)) return false;
    return true;
  });
}

function findSet(catalog: IndexedCatalog, tokens: string[], number: string | null) {
  let best: { setIds: string[]; consumed: Set<number>; words: number; names: number } | null = null;
  for (const alias of catalog.aliases) {
    if (alias.words.length > tokens.length) continue;
    const code = alias.words[0] ?? "";
    if (alias.words.length === 1 && RESERVED_CODES.has(code)) continue;
    for (let start = 0; start <= tokens.length - alias.words.length; start += 1) {
      let matches = true;
      for (let offset = 0; offset < alias.words.length; offset += 1) {
        if (tokens[start + offset] !== alias.words[offset]) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;
      const consumed = new Set(alias.words.map((_, offset) => start + offset));
      const names = nameLeft(tokens, consumed, number);
      if (alias.words.length === 1 && /^\d+$/.test(code) && names.length === 0) continue;
      if (alias.words.length === 1 && names.length === 0 && catalog.tokenIndex.has(code)) continue;
      const hit = { setIds: alias.sets, consumed, words: alias.words.length, names: names.length };
      if (!best || hit.words > best.words || (hit.words === best.words && hit.names > best.names)) best = hit;
    }
  }
  return { setIds: best?.setIds ?? [], consumed: best?.consumed ?? new Set<number>() };
}

function fuzzySetWord(catalog: IndexedCatalog, token: string): { word: string; sets: string[] } | null {
  if (token.length < 5 || catalog.tokenIndex.has(token)) return null;
  const max = token.length >= 8 ? 2 : 1;
  let best: { distance: number; word: string; sets: string[] } | null = null;
  let runner = max + 1;
  for (const alias of catalog.aliases) {
    if (alias.words.length !== 1) continue;
    const word = alias.words[0] ?? "";
    if (!word || word[0] !== token[0] || Math.abs(word.length - token.length) > max) continue;
    const distance = levenshtein(token, word, max);
    if (distance === 0 || distance > max) continue;
    if (!best || distance < best.distance) {
      runner = best ? best.distance : runner;
      best = { distance, word, sets: alias.sets };
    } else if (distance < runner) runner = distance;
  }
  if (!best || best.distance === runner) return null;
  return { word: best.word, sets: best.sets };
}

function nameTokensOf(line: ParsedLine, consumed: Set<number>): string[] {
  return line.tokens.filter((token, index) => {
    if (consumed.has(index)) return false;
    if (line.number && token === line.number) return false;
    if (NOISE.has(token)) return false;
    return true;
  });
}

function scoreCard(card: CatalogCard, nameTokens: string[], setIds: string[], number: string | null, modifiers: string[]): number {
  const tokens = cardTokens(card);
  let nameScore = 0.42;
  if (nameTokens.length > 0) {
    let hit = 0;
    for (const token of nameTokens) {
      if (tokens.includes(token)) {
        hit += 1;
        continue;
      }
      const near = tokens.find((printed) => {
        if (printed.length < 5 || token.length < 5) return false;
        const max = Math.max(printed.length, token.length) >= 8 ? 2 : 1;
        return Math.abs(printed.length - token.length) <= max && levenshtein(token, printed, max) <= max;
      });
      if (near) hit += 0.86;
    }
    const recall = hit / nameTokens.length;
    const joined = nameTokens.join(" ");
    const printed = tokens.join(" ");
    const distance = levenshtein(joined, printed, 12);
    const ratio = 1 - distance / Math.max(joined.length, printed.length, 1);
    const exact = joined === printed ? 0.12 : 0;
    const extra = Math.max(0, tokens.length - nameTokens.length) * 0.035;
    nameScore = 0.64 * recall + 0.36 * Math.max(0, ratio) + exact - extra;
  }

  let score = nameScore * 0.62;
  if (setIds.length > 0) score += setIds.includes(card.set) ? 0.23 : -0.3;
  if (number) score += numbersEqual(number, card.num) ? 0.32 : -0.38;

  for (const stage of nameTokens) {
    if (!STAGES.has(stage)) continue;
    score += hasStage(card, tokens, stage) ? 0.05 : -0.07;
  }
  if (modifiers.includes("promo") && /promo/i.test(card.rarity)) score += 0.05;
  return score;
}

function collect(catalog: IndexedCatalog, nameTokens: string[], setIds: string[], number: string | null): number[] {
  const indexes = new Set<number>();
  const expanded = nameTokens.flatMap((token) => [token, ...fuzzyWords(catalog, token)]);
  for (const token of expanded) {
    const bucket = catalog.tokenIndex.get(token);
    if (!bucket || bucket.length > 1800) continue;
    for (const index of bucket) indexes.add(index);
  }
  if (setIds.length > 0 && number) {
    for (const setId of setIds) {
      for (const index of catalog.setIndex.get(setId) ?? []) {
        const card = catalog.cards[index];
        if (card && numbersEqual(number, card.num)) indexes.add(index);
      }
    }
  }
  if (indexes.size === 0 && setIds.length > 0) {
    for (const setId of setIds) {
      for (const index of catalog.setIndex.get(setId) ?? []) indexes.add(index);
    }
  }
  return [...indexes].slice(0, 900);
}

function correctionsFor(card: CatalogCard, nameTokens: string[]): string[] {
  const tokens = cardTokens(card);
  const corrections: string[] = [];
  for (const token of nameTokens) {
    if (tokens.includes(token) || token.length < 5) continue;
    const near = tokens.find((printed) => {
      const max = Math.max(printed.length, token.length) >= 8 ? 2 : 1;
      return printed.length >= 5 && Math.abs(printed.length - token.length) <= max && levenshtein(token, printed, max) <= max;
    });
    if (near) corrections.push(`${token} → ${near}`);
  }
  return corrections;
}

function notesFor(line: ParsedLine): string[] {
  const notes: string[] = [];
  if (line.stampRead) {
    notes.push("“Stamp” is read as the reverse holo, the printing that carries the set stamp. Pick another printing below if you meant something else.");
  }
  if (line.modifiers.includes("shadowless")) {
    notes.push("Shadowless isn’t its own row. Check the border.");
  }
  return notes;
}

function resolveLine(catalog: IndexedCatalog, line: ParsedLine): ResolveItem {
  let located = findSet(catalog, line.tokens, line.number);
  const setCorrections: string[] = [];
  if (located.setIds.length === 0) {
    for (let index = 0; index < line.tokens.length; index += 1) {
      const token = line.tokens[index] ?? "";
      if (line.number && token === line.number) continue;
      const hit = fuzzySetWord(catalog, token);
      if (!hit) continue;
      located = { setIds: hit.sets, consumed: new Set([index]) };
      setCorrections.push(`${token} → ${hit.word}`);
      break;
    }
  }
  const nameTokens = nameTokensOf(line, located.consumed);
  const base = {
    raw: line.raw,
    quantity: line.quantity,
    modifiers: line.modifiers,
    grading: line.grading,
    finish: line.finish,
    stampRead: line.stampRead,
    notes: notesFor(line),
    corrections: [] as string[],
  };

  if (nameTokens.length === 0 && (located.setIds.length === 0 || !line.number)) {
    return { ...base, status: "unmatched", confidence: 0, card: null, alternatives: [] };
  }

  const ranked: Scored[] = collect(catalog, nameTokens, located.setIds, line.number)
    .map((index) => ({
      index,
      score: scoreCard(catalog.cards[index] as CatalogCard, nameTokens, located.setIds, line.number, line.modifiers),
      corrections: [],
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.score < 0.4) {
    const alternatives = ranked
      .filter((entry) => entry.score >= 0.34)
      .slice(0, 4)
      .map((entry) => toPublic(catalog, catalog.cards[entry.index] as CatalogCard));
    return { ...base, status: "unmatched", confidence: best?.score ?? 0, card: null, alternatives };
  }

  const winner = catalog.cards[best.index] as CatalogCard;
  const sameSlot = ranked.filter((entry) => {
    const card = catalog.cards[entry.index] as CatalogCard;
    return Boolean(line.number) && located.setIds.includes(card.set) && numbersEqual(line.number as string, card.num);
  });
  const lead = second ? best.score - second.score : 1;
  const locked = sameSlot.length === 1 && best.score >= 0.5;
  const status = locked || (best.score >= 0.72 && lead >= 0.075) ? "matched" : "ambiguous";
  const alternatives = ranked
    .slice(1)
    .filter((entry) => entry.score >= 0.4 && best.score - entry.score <= 0.28)
    .slice(0, 4)
    .map((entry) => toPublic(catalog, catalog.cards[entry.index] as CatalogCard));

  return {
    ...base,
    status,
    confidence: Math.max(0, Math.min(1, best.score)),
    corrections: [...setCorrections, ...correctionsFor(winner, nameTokens)],
    card: toPublic(catalog, winner),
    alternatives,
  };
}

const BULK = /^(?:please\s+)?(?:include|add|show|list|pull)\s+(?:me\s+)?(?:all|every)\b|^(?:all|every)\s+(?:the\s+|of\s+)?/;

function numberRank(num: string): number {
  const match = /(\d+)/.exec(num);
  return match ? Number(match[1]) : 9999;
}

function expandBulk(catalog: IndexedCatalog, line: ParsedLine): ResolveItem[] | null {
  const text = normalize(line.raw);
  if (!BULK.test(text)) return null;
  const stripped = text
    .replace(/^(?:please\s+)?(?:include|add|show|list|pull)\s+(?:me\s+)?/, "")
    .replace(/^(?:all|every)\s+(?:the\s+|of\s+)?/, "")
    .replace(/\b(?:cards?|printings?|stamps?|from|for|in|of|the|set)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const inner = parseList(stripped)[0];
  const blank = {
    raw: line.raw,
    quantity: 1,
    modifiers: line.modifiers,
    grading: line.grading,
    finish: line.finish,
    stampRead: line.stampRead,
    corrections: [] as string[],
  };
  if (!inner) {
    return [{ ...blank, status: "unmatched", confidence: 0, card: null, alternatives: [], notes: ["Name a card or a set after “include all”."] }];
  }
  const located = findSet(catalog, inner.tokens, inner.number);
  const stampRead = inner.stampRead || /\bstamps?\b/.test(text);
  const finish = stampRead && !inner.finish ? "reverse" : inner.finish;
  let names = nameTokensOf(inner, located.consumed).filter((token) => !["stamp", "stamps", "stamped", "holo", "holos", "holofoil"].includes(token));
  if (located.setIds.length > 0) names = names.filter((token) => token !== "ex");
  const holoOnly = finish === "holo";
  const pool = catalog.cards.filter((card) => {
    if (located.setIds.length > 0 && !located.setIds.includes(card.set)) return false;
    if (names.length > 0 && !names.every((token) => cardTokens(card).includes(token))) return false;
    if (located.setIds.length === 0 && names.length === 0) return false;
    if (holoOnly && (!/holo/i.test(card.rarity) || /reverse/i.test(card.rarity))) return false;
    return true;
  });
  pool.sort((a, b) => numberRank(a.num) - numberRank(b.num) || a.name.localeCompare(b.name));
  if (pool.length === 0) {
    return [{ ...blank, modifiers: inner.modifiers, finish, stampRead, status: "unmatched", confidence: 0, card: null, alternatives: [], notes: ["That request didn’t match a set or a card name."] }];
  }
  const kept = pool.slice(0, MAX_LINES);
  const label = holoOnly ? "holo cards" : stampRead || finish === "reverse" ? "reverse-holo printings" : "cards";
  return kept.map((card, index) => ({
    ...blank,
    modifiers: inner.modifiers,
    finish,
    stampRead,
    status: "matched" as const,
    confidence: 1,
    notes: [
      `Included because you asked for every ${label}.`,
      ...(pool.length > kept.length && index === kept.length - 1 ? [`Showing ${kept.length} of ${pool.length}. The list stops at ${MAX_LINES}.`] : []),
    ],
    card: toPublic(catalog, card),
    alternatives: [],
  }));
}

export function resolveText(catalog: IndexedCatalog, text: string): ResolveItem[] {
  const lines = parseList(text);
  if (lines.length > MAX_LINES) {
    throw new RangeError(`Keep a pull to ${MAX_LINES} cards.`);
  }
  const items: ResolveItem[] = [];
  for (const line of lines) {
    const bulk = expandBulk(catalog, line);
    if (bulk) {
      const room = MAX_LINES - items.length;
      if (room <= 0) break;
      const slice = bulk.slice(0, room);
      if (bulk.length > room) {
        const last = slice[slice.length - 1];
        if (last) last.notes = [...last.notes, `Showing ${items.length + slice.length} cards. The list stops at ${MAX_LINES}.`];
      }
      items.push(...slice);
      continue;
    }
    items.push(resolveLine(catalog, line));
  }
  return items;
}
