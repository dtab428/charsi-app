"use client";

import { Pressable } from "@/components/ui/ripple";
import { finishOf, finishRank, variantLabel, type Finish } from "@/lib/format";
import type { VariantQuote } from "@/lib/types";

const NOTE: Record<Finish, string> = {
  normal: "Plain card, no foil.",
  holo: "Foil on the artwork.",
  reverse: "Foil everywhere except the art. Carries the set stamp.",
};

function noteFor(key: string): string {
  const finish = finishOf(key);
  return finish ? NOTE[finish] : "";
}

export function PrintingPicker({
  variants,
  activeKey,
  needsPick,
  missing,
  onPick,
  hrefFor,
}: {
  variants: VariantQuote[];
  activeKey: string | null;
  needsPick: boolean;
  missing: Finish | null;
  onPick?: (key: string) => void;
  hrefFor?: (key: string) => string;
}) {
  const ordered = variants.slice().sort((a, b) => finishRank(a.key) - finishRank(b.key)).slice(0, 6);
  if (ordered.length < 2 && !missing) return null;

  const option = (entry: VariantQuote, large: boolean) => {
    const active = entry.key === activeKey;
    const base = large
      ? "flex min-w-[8.5rem] flex-1 flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left"
      : "rounded-full border px-3 py-1.5 text-sm";
    const tone = active ? "border-transparent bg-[#efe6d4] text-[#241c14]" : large ? "border-[#f0d7a4]/50 bg-[#14110e] hover:bg-white/10" : "border-white/15 hover:bg-white/10";
    return (
      <Pressable
        key={entry.key}
        sameTab={Boolean(hrefFor)}
        href={hrefFor?.(entry.key)}
        onClick={onPick ? () => onPick(entry.key) : undefined}
        className={`${base} ${tone}`}
      >
        <span className={large ? "text-base font-medium" : ""}>{variantLabel(entry.key)}</span>
        {large ? <span className={`text-xs leading-snug ${active ? "text-[#241c14]/75" : "text-[#b3a694]"}`}>{noteFor(entry.key)}</span> : null}
      </Pressable>
    );
  };

  if (needsPick) {
    return (
      <div role="group" aria-label="Choose a printing" className="rounded-2xl border-2 border-[#f0d7a4] bg-[#2a2216] p-4 shadow-[0_0_0_4px_rgba(240,215,164,0.12)]">
        <p className="font-serif text-xl italic text-[#f3ecdf]">Which printing do you mean?</p>
        <p className="mt-1 text-xs leading-relaxed text-[#d8c9ab]">This card comes in more than one. The picture, price, and sales are different for each, so pick one to continue.</p>
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
