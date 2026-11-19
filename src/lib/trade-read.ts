import type { IndexedCatalog } from "./catalog";
import { resolveText } from "./resolve";
import type { TradePost } from "./reddit";

export type TradeMatch = { id: string; name: string; setName: string; number: string; printedTotal: number };

const LOT = /\b(binder|collection|hundreds|lot\b|bulk|sealed|various|tons|many cards|whole set)\b/i;

export function readTrade(catalog: IndexedCatalog, post: TradePost): { matches: TradeMatch[]; note: string } {
  if (LOT.test(post.title)) {
    return { matches: [], note: "This post is a group of cards. The title doesn’t name one printing, so nothing was pinned. A photo with several cards was not split apart." };
  }
  const cleaned = post.title.replace(/\[[^\]]{0,40}\]/g, " ");
  let items: ReturnType<typeof resolveText> = [];
  try {
    items = resolveText(catalog, cleaned);
  } catch {
    items = [];
  }
  const matches = items
    .filter((item) => item.card && (item.status === "matched" || item.confidence >= 0.72))
    .slice(0, 4)
    .map((item) => ({
      id: item.card?.id ?? "",
      name: item.card?.name ?? "",
      setName: item.card?.setName ?? "",
      number: item.card?.number ?? "",
      printedTotal: item.card?.printedTotal ?? 0,
    }));
  if (matches.length === 0) {
    return { matches: [], note: "The title doesn’t name one card clearly. Open the post and use the pictures there." };
  }
  if (matches.length > 1) {
    return { matches, note: "The title names more than one card. These are the ones that read cleanly. A photo of several cards was not split apart." };
  }
  return { matches, note: post.pictures.length > 1 ? "More than one picture is attached. Only the title was matched." : "" };
}
