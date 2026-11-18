const CARD = /^[a-z0-9][a-z0-9-]{1,48}$/i;
const PRINTING = /^[a-z0-9-]{1,40}$/;

export type DeskShare = { q: string; card: string | null; printing: string | null };

export function deskShareFrom(search: string): DeskShare | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const q = params.get("q")?.replace(/\s+/g, " ").trim() ?? "";
  if (!q || q.length > 2000) return null;
  const card = params.get("card");
  const printing = params.get("printing");
  return {
    q,
    card: card && CARD.test(card) ? card : null,
    printing: printing && PRINTING.test(printing) ? printing : null,
  };
}

export function deskShareHref(q: string, card?: string | null, printing?: string | null): string {
  const params = new URLSearchParams();
  params.set("q", q.trim());
  if (card && CARD.test(card)) params.set("card", card);
  if (card && printing && PRINTING.test(printing)) params.set("printing", printing);
  return `/?${params.toString()}`;
}
