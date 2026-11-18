// Reverses from Team Rocket Returns through Power Keepers carry the set's own
// logo, stamped in the lower-right corner of the artwork. Skyridge and the
// earlier EX sets have no stamp.
const STAMPED = new Set(["ex7", "ex8", "ex9", "ex10", "ex11", "ex12", "ex13", "ex14", "ex15", "ex16"]);

// Percent of the card. The box is the artwork's lower-right corner; the logo
// keeps its proportions and hugs the box's right and bottom edges.
export const STAMP_BOX = { right: 8.2, bottom: 57.2, width: 26, height: 8.5 };

export function stampLogo(id: string | null | undefined): string | null {
  if (!id || !STAMPED.has(id)) return null;
  return `/stamps/${id}.png`;
}
