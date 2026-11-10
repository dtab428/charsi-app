import fs from "node:fs";
import path from "node:path";
import type { CatalogCard, CatalogSet, PublicCard } from "./types";
import { normalize } from "./parse";

type Alias = { phrase: string; words: string[]; sets: string[] };

export type IndexedCatalog = {
  cards: CatalogCard[];
  sets: Map<string, CatalogSet>;
  aliases: Alias[];
  tokenIndex: Map<string, number[]>;
  dictionary: Map<string, string[]>;
  setIndex: Map<string, number[]>;
};

type CatalogFile = {
  sets: CatalogSet[];
  aliases: { phrase: string; sets: string[] }[];
  cards: CatalogCard[];
};

const globalCache = globalThis as unknown as { __surroundCatalog?: IndexedCatalog };

export function getCatalog(): IndexedCatalog {
  if (globalCache.__surroundCatalog) return globalCache.__surroundCatalog;
  const file = path.join(process.cwd(), "data/catalog/pokemon.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as CatalogFile;
  const sets = new Map(raw.sets.map((set) => [set.id, set]));
  const tokenIndex = new Map<string, number[]>();
  const setIndex = new Map<string, number[]>();
  const words = new Set<string>();

  raw.cards.forEach((card, index) => {
    for (const token of normalize(card.name).split(" ").filter(Boolean)) {
      if (token.length < 2) continue;
      const bucket = tokenIndex.get(token);
      if (bucket) bucket.push(index);
      else tokenIndex.set(token, [index]);
      if (token.length >= 5) words.add(token);
    }
    const inSet = setIndex.get(card.set);
    if (inSet) inSet.push(index);
    else setIndex.set(card.set, [index]);
  });

  const dictionary = new Map<string, string[]>();
  for (const word of words) {
    const letter = word[0] ?? "";
    const bucket = dictionary.get(letter);
    if (bucket) bucket.push(word);
    else dictionary.set(letter, [word]);
  }

  const aliases = raw.aliases
    .map((alias) => {
      const phrase = normalize(alias.phrase);
      return { phrase, words: phrase.split(" ").filter(Boolean), sets: alias.sets };
    })
    .filter((alias) => alias.words.length > 0)
    .sort((a, b) => b.words.length - a.words.length || b.phrase.length - a.phrase.length);

  globalCache.__surroundCatalog = { cards: raw.cards, sets, aliases, tokenIndex, dictionary, setIndex };
  return globalCache.__surroundCatalog;
}

export function toPublic(catalog: IndexedCatalog, card: CatalogCard): PublicCard {
  const set = catalog.sets.get(card.set);
  return {
    id: card.id,
    name: card.name,
    supertype: card.super,
    subtypes: card.subs,
    hp: card.hp,
    types: card.types,
    setId: card.set,
    setName: set?.name ?? card.set,
    setCode: set?.code ?? "",
    series: set?.series ?? "",
    number: card.num,
    printedTotal: set?.printed ?? 0,
    rarity: card.rarity,
    artist: card.artist,
    dex: card.dex,
    regulation: card.reg,
    small: card.small,
    large: card.large || card.small,
    attacks: card.attacks,
    standard: card.standard,
    expanded: card.expanded,
    releaseDate: set?.released ?? "",
    symbol: set?.symbol ?? "",
  };
}
