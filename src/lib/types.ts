export type CatalogCard = {
  id: string;
  name: string;
  super: string;
  subs: string[];
  hp: string;
  types: string[];
  set: string;
  num: string;
  rarity: string;
  artist: string;
  dex: number | null;
  reg: string;
  small: string;
  large: string;
  attacks: string[];
  standard: string;
  expanded: string;
};

export type CatalogSet = {
  id: string;
  name: string;
  series: string;
  code: string;
  printed: number;
  total: number;
  released: string;
  symbol: string;
};

export type PublicCard = {
  id: string;
  name: string;
  supertype: string;
  subtypes: string[];
  hp: string;
  types: string[];
  setId: string;
  setName: string;
  setCode: string;
  series: string;
  number: string;
  printedTotal: number;
  rarity: string;
  artist: string;
  dex: number | null;
  regulation: string;
  small: string;
  large: string;
  attacks: string[];
  standard: string;
  expanded: string;
  releaseDate: string;
  symbol: string;
};

export type ResolveStatus = "matched" | "ambiguous" | "unmatched";

export type ResolveItem = {
  raw: string;
  quantity: number;
  modifiers: string[];
  status: ResolveStatus;
  confidence: number;
  notes: string[];
  corrections: string[];
  card: PublicCard | null;
  alternatives: PublicCard[];
};

export type VariantQuote = {
  key: string;
  label: string;
  market: number | null;
  low: number | null;
  mid: number | null;
  high: number | null;
  currency: string;
};

export type TrendPoint = {
  days: number;
  change: number | null;
  percent: number | null;
};

export type GradedQuote = {
  company: string;
  grade: string;
  market: number | null;
  low: number | null;
  high: number | null;
  currency: string;
};

export type EuroSales = {
  trend: number | null;
  avg1: number | null;
  avg7: number | null;
  avg30: number | null;
  low: number | null;
};

export type CardmarketQuote = EuroSales & {
  currency: "EUR";
  updatedAt: string | null;
  url: string | null;
  holo: EuroSales | null;
};

export type PriceQuote = {
  source: "scrydex" | "pokemon-tcg" | "tcgdex";
  updatedAt: string | null;
  productUrl: string | null;
  variants: VariantQuote[];
  cardmarket: CardmarketQuote | null;
  graded: GradedQuote[];
  trends: TrendPoint[];
};

export type Listing = {
  title: string;
  url: string;
  price: number | null;
  currency: string;
  bids: number | null;
  endsAt: string | null;
  shipping: string | null;
  condition: string | null;
};

export type ListingLane = {
  status: "live" | "unconfigured" | "error" | "empty";
  listings: Listing[];
  searchUrl: string;
  notice: string | null;
};

export type Pin = {
  source: "facebook" | "discord" | "other";
  price: string;
  note: string;
};

export type GameOption = {
  id: string;
  name: string;
  state: "live" | "next";
};
