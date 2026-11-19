const MODIFIER_PHRASES: [string, string][] = [
  ["non holofoil", "nonholo"],
  ["non holo", "nonholo"],
  ["nonholo", "nonholo"],
  ["non foil", "nonholo"],
  ["reverse holofoil", "reverse"],
  ["reverse holo", "reverse"],
  ["reverse foil", "reverse"],
  ["rev holo", "reverse"],
  ["first edition", "first"],
  ["1st edition", "first"],
  ["pre release", "prerelease"],
];

const COMPANY_NAMES: Record<string, string> = { psa: "PSA", bgs: "BGS", beckett: "BGS", cgc: "CGC", sgc: "SGC", tag: "TAG" };
const GRADED_WITH_NUMBER = /\b(psa|bgs|beckett|cgc|sgc|tag)\s*[-:]?\s*(10|[1-9](?:\.5)?)(?!\d)/i;
const GRADED_WORD_ONLY = /\b(psa|bgs|beckett|cgc|sgc)\b/i;

export type LineFinish = "normal" | "holo" | "reverse";
export type LineGrading = { company: string; grade: string | null };

function pullGrading(raw: string): { text: string; grading: LineGrading | null } {
  const withGrade = GRADED_WITH_NUMBER.exec(raw);
  if (withGrade) {
    return {
      text: `${raw.slice(0, withGrade.index)} ${raw.slice(withGrade.index + withGrade[0].length)}`,
      grading: { company: COMPANY_NAMES[(withGrade[1] ?? "").toLowerCase()] ?? "PSA", grade: withGrade[2] ?? null },
    };
  }
  const word = GRADED_WORD_ONLY.exec(raw);
  if (word) {
    return {
      text: `${raw.slice(0, word.index)} ${raw.slice(word.index + word[0].length)}`,
      grading: { company: COMPANY_NAMES[(word[1] ?? "").toLowerCase()] ?? "PSA", grade: null },
    };
  }
  return { text: raw, grading: null };
}

function finishFrom(modifiers: string[]): { finish: LineFinish | null; stampRead: boolean } {
  if (modifiers.includes("reverse")) return { finish: "reverse", stampRead: false };
  if (modifiers.includes("nonholo")) return { finish: "normal", stampRead: false };
  if (modifiers.includes("holo")) return { finish: "holo", stampRead: false };
  if (modifiers.includes("stamp")) return { finish: "reverse", stampRead: true };
  return { finish: null, stampRead: false };
}

const MODIFIER_WORDS: Record<string, string> = {
  stamp: "stamp",
  stamped: "stamp",
  cosmos: "cosmos",
  holo: "holo",
  holofoil: "holo",
  holographic: "holo",
  reverse: "reverse",
  rev: "reverse",
  shadowless: "shadowless",
  "1st": "first",
  first: "first",
  unlimited: "unlimited",
  staff: "staff",
  prerelease: "prerelease",
  promo: "promo",
};

const SKIP_LINES = new Set(["wants", "want", "looking for", "trade", "trades", "iso", "list", "for trade"]);

export type ParsedLine = {
  raw: string;
  quantity: number;
  modifiers: string[];
  number: string | null;
  tokens: string[];
  grading: LineGrading | null;
  finish: LineFinish | null;
  stampRead: boolean;
};

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function splitList(text: string): string[] {
  const parts: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    for (const piece of line.split(/[,;]+/)) {
      const cleaned = piece.replace(/^[\s>*•\-–]+/, "").replace(/^\d{1,2}[.)]\s+(?=\D)/, "").trim();
      if (cleaned) parts.push(cleaned);
    }
  }
  return parts;
}

function pullModifiers(phrase: string): { phrase: string; modifiers: string[] } {
  const modifiers: string[] = [];
  let working = phrase;
  for (const [words, name] of MODIFIER_PHRASES) {
    if (working.includes(words)) {
      modifiers.push(name);
      working = working.replace(words, " ");
    }
  }
  const kept: string[] = [];
  for (const token of working.split(" ").filter(Boolean)) {
    const modifier = MODIFIER_WORDS[token];
    if (modifier) modifiers.push(modifier);
    else kept.push(token);
  }
  return { phrase: kept.join(" "), modifiers: [...new Set(modifiers)] };
}

function pullQuantity(phrase: string): { phrase: string; quantity: number } {
  const leading = /^(\d{1,2})\s*x\b/.exec(phrase) ?? /^x\s*(\d{1,2})\b/.exec(phrase);
  if (!leading) return { phrase, quantity: 1 };
  const quantity = Number(leading[1]);
  return {
    phrase: phrase.slice(leading[0].length).trim(),
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
  };
}

function pullExplicitNumber(phrase: string): { phrase: string; number: string | null } {
  const fraction = /\b(\d{1,3})\s*\/\s*\d{1,3}\b/.exec(phrase);
  if (fraction) {
    return {
      number: fraction[1],
      phrase: `${phrase.slice(0, fraction.index)} ${phrase.slice(fraction.index + fraction[0].length)}`.trim(),
    };
  }
  const hash = /#\s*([a-z]{0,5}\d{1,4})\b/.exec(phrase);
  if (hash) {
    return {
      number: hash[1],
      phrase: `${phrase.slice(0, hash.index)} ${phrase.slice(hash.index + hash[0].length)}`.trim(),
    };
  }
  return { phrase, number: null };
}

export function parseList(text: string): ParsedLine[] {
  const lines: ParsedLine[] = [];
  for (const raw of splitList(text)) {
    const graded = pullGrading(raw);
    let phrase = normalize(graded.text).replace(/\b\d{1,3}\s*hp\b/g, " ");
    if (!phrase || SKIP_LINES.has(phrase)) continue;
    const quantity = pullQuantity(phrase);
    phrase = quantity.phrase;
    const numbered = pullExplicitNumber(phrase);
    phrase = numbered.phrase;
    const modified = pullModifiers(phrase);
    const tokens = modified.phrase.split(" ").filter(Boolean);
    let number = numbered.number;
    if (!number) {
      const last = tokens[tokens.length - 1];
      if (last && ((/^\d{1,3}$/.test(last) && Number(last) < 1990) || /^[a-z]{1,4}\d{3,4}$/.test(last))) {
        number = last;
      }
    }
    if (tokens.length === 0 && !number) continue;
    const asked = finishFrom(modified.modifiers);
    lines.push({
      raw,
      quantity: quantity.quantity,
      modifiers: modified.modifiers,
      number,
      tokens,
      grading: graded.grading,
      finish: asked.finish,
      stampRead: asked.stampRead,
    });
  }
  return lines;
}

export function numbersEqual(query: string, printed: string): boolean {
  const left = query.trim().toLowerCase();
  const right = printed.trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;
  if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
    return String(Number(left)) === String(Number(right));
  }
  return false;
}
