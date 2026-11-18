"use client";

import { Pressable } from "@/components/ui/ripple";
import { editionOf, finishOf, printingRank, variantLabel, type Finish } from "@/lib/format";
import type { VariantQuote } from "@/lib/types";

function noteFor(key: string, stamped: boolean): string {
  const finish = finishOf(key);
  const edition = editionOf(key);
  const editionNote = edition === "first" ? "First print run." : edition === "unlimited" ? "Later print run." : edition === "shadowless" ? "Shadowless border." : "";
  const finishNote =
    finish === "reverse"
      ? stamped
        ? "Foil everywhere except the art, with the set stamp."
        : "Foil everywhere except the art."
      : finish === "holo"
        ? "Foil on the artwork."
        : finish === "normal"
          ? "No foil."
          : "";
  return [editionNote, finishNote].filter(Boolean).join(" ");
}

export function PrintingPicker({
  variants,
  activeKey,
  activeCardId = null,
  needsPick,
  missing,
  stamped = false,
  onPick,
  hrefFor,
  captionFor,
}: {
  variants: VariantQuote[];
  activeKey: string | null;
  activeCardId?: string | null;
  needsPick: boolean;
  missing: Finish | null;
  stamped?: boolean;
  onPick?: (cardId: string, key: string) => void;
  hrefFor?: (entry: VariantQuote) => string;
  captionFor?: (entry: VariantQuote) => string;
}) {
  const ordered = variants.slice().sort((a, b) => printingRank(a.key) - printingRank(b.key)).slice(0, 8);
  if (ordered.length < 2 && !missing) return null;

  const option = (entry: VariantQuote, large: boolean) => {
    const selected = entry.key === activeKey && (!activeCardId || !entry.cardId || entry.cardId === activeCardId);
    const base = large
      ? "flex min-w-[10.5rem] flex-1 flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left"
      : "rounded-full border px-3 py-1.5 text-sm";
    const tone = selected ? "border-transparent bg-[#efe6d4] text-[#241c14]" : large ? "border-[#f0d7a4]/50 bg-[#14110e] hover:bg-white/10" : "border-white/15 hover:bg-white/10";
    const caption = captionFor?.(entry);
    return (
      <Pressable
        key={`${entry.cardId ?? ""}:${entry.key}`}
        sameTab={Boolean(hrefFor)}
        href={hrefFor?.(entry)}
        onClick={onPick ? () => onPick(entry.cardId ?? "", entry.key) : undefined}
        className={`${base} ${tone}`}
      >
        <span className={large ? "text-base font-medium" : ""}>{variantLabel(entry.key)}</span>
        {large && caption ? <span className={`text-[11px] ${selected ? "text-[#241c14]/70" : "text-[#d4a574]"}`}>{caption}</span> : null}
        {large ? <span className={`text-xs leading-snug ${selected ? "text-[#241c14]/75" : "text-[#b3a694]"}`}>{noteFor(entry.key, stamped)}</span> : null}
      </Pressable>
    );
  };

  if (needsPick) {
    return (
      <div role="group" aria-label="Choose a printing" className="rounded-2xl border-2 border-[#f0d7a4] bg-[#2a2216] p-4 shadow-[0_0_0_4px_rgba(240,215,164,0.12)]">
        <p className="font-serif text-xl italic text-[#f3ecdf]">Which printing do you mean?</p>
        <p className="mt-1 text-xs leading-relaxed text-[#d8c9ab]">These printings are easy to mix up. The picture and the price change with each one, so pick one to continue.</p>
        <div className="mt-3 flex flex-wrap gap-2">{ordered.map((entry) => option(entry, true))}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div role="group" aria-label="Printing" className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] tracking-[0.14em] text-[#b3a694] uppercase">Printing</span>
        {ordered.map((entry) => option(entry, false))}
      </div>
      {missing ? <p className="text-[11px] leading-relaxed text-[#d4a574]">There’s no {variantLabel(missing === "reverse" ? "reverseHolofoil" : missing === "holo" ? "holofoil" : "normal").toLowerCase()} price in the feeds for this card, so a different printing is showing. Pick the one you want above.</p> : null}
    </div>
  );
}
