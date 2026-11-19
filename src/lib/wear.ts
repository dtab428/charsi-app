export const WEARS = ["NM", "LP", "MP", "HP", "DMG"] as const;
export type Wear = (typeof WEARS)[number];

export const WEAR_LABEL: Record<Wear, string> = {
  NM: "Near Mint",
  LP: "Lightly Played",
  MP: "Moderately Played",
  HP: "Heavily Played",
  DMG: "Damaged",
};

// eBay's Pokémon singles category has these four card-condition values.
// Damaged is a TCGplayer condition and is not one of eBay's descriptors.
export const EBAY_WEAR: Partial<Record<Wear, string>> = {
  NM: "Near Mint or Better",
  LP: "Lightly Played (Excellent)",
  MP: "Moderately Played (Very Good)",
  HP: "Heavily Played (Poor)",
};

export function isWear(value: string | null | undefined): value is Wear {
  if (!value) return false;
  return (WEARS as readonly string[]).includes(value.toUpperCase());
}

export function asWear(value: string | null | undefined): Wear {
  if (!value) return "NM";
  const upper = value.toUpperCase();
  return isWear(upper) ? upper : "NM";
}
