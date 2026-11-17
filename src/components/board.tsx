"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { CardMarket } from "@/components/market";
import { Pressable } from "@/components/ui/ripple";
import type { Filters } from "@/lib/feed";
import { emptyLane } from "@/lib/links";
import type { ListingLane, Pin, PriceQuote, PublicCard, ResolveItem } from "@/lib/types";

export type DeskItem = ResolveItem & { key: string; included: boolean };

const emptyPin: Pin = { source: "discord", price: "", note: "" };

function printed(card: PublicCard): string {
  const code = card.setCode || card.setName;
  const number = card.printedTotal ? `${card.number}/${card.printedTotal}` : card.number;
  return `${code} · ${number}`;
}

function legal(card: PublicCard): string {
  if (card.standard === "Legal") return "Standard";
  if (card.expanded === "Legal") return "Expanded";
  if (card.standard === "Banned") return "Not Standard";
  return "Unlimited";
}

function Face({ card, onZoom }: { card: PublicCard; onZoom: (card: PublicCard) => void }) {
  return (
    <Pressable onClick={() => onZoom(card)} className="block w-full rounded-md text-left">
      <Image
        src={card.small || card.large}
        alt={card.name}
        width={245}
        height={342}
        unoptimized
        className="rounded-md bg-[#2a241e]"
        style={{ width: "100%", height: "auto" }}
      />
    </Pressable>
  );
}

function Actions({
  item,
  onInclude,
  onRemove,
  onCopy,
  onSave,
}: {
  item: DeskItem;
  onInclude: (key: string, included: boolean) => void;
  onRemove: (key: string) => void;
  onCopy: (card: PublicCard) => void;
  onSave: (card: PublicCard) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {item.card ? (
        <Button type="button" size="sm" variant={item.included ? "default" : "outline"} onClick={() => onInclude(item.key, !item.included)}>
          {item.included ? "On the sheet" : "Off the sheet"}
        </Button>
      ) : null}
      {item.card ? (
        <Button type="button" size="sm" variant="secondary" onClick={() => item.card && onCopy(item.card)}>
          Copy
        </Button>
      ) : null}
      {item.card ? (
        <Button type="button" size="sm" variant="secondary" onClick={() => item.card && onSave(item.card)}>
          Save
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(item.key)}>
        Remove
      </Button>
    </div>
  );
}

function CardDesk({
  item,
  quote,
  loadingQuotes,
  lanes,
  pin,
  filters,
  onPin,
  onInclude,
  onRemove,
  onChoose,
  onCopy,
  onSave,
  onZoom,
}: {
  item: DeskItem;
  quote: PriceQuote | null | undefined;
  loadingQuotes: boolean;
  lanes: { auctions: ListingLane; buyNow: ListingLane } | undefined;
  pin: Pin;
  filters: Filters;
  onPin: (pin: Pin) => void;
  onInclude: (key: string, included: boolean) => void;
  onRemove: (key: string) => void;
  onChoose: (key: string, card: PublicCard) => void;
  onCopy: (card: PublicCard) => void;
  onSave: (card: PublicCard) => void;
  onZoom: (card: PublicCard) => void;
}) {
  const card = item.card;
  const auctions = card ? lanes?.auctions ?? emptyLane(card, "auction") : null;
  const buyNow = card ? lanes?.buyNow ?? emptyLane(card, "bin") : null;

  return (
    <li className="rounded-[24px] border border-white/10 bg-[#1c1814]/80 p-3 sm:p-5">
      <div className="flex gap-3 sm:gap-5">
        <div className="w-24 shrink-0 self-start sm:w-40 lg:w-48">
          {card ? (
            <Face card={card} onZoom={onZoom} />
          ) : (
            <div className="flex aspect-[63/88] items-end rounded-md border border-dashed border-white/15 p-2 text-xs text-[#b3a694]">{item.raw}</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="font-serif text-2xl leading-none tracking-tight sm:text-3xl">{card?.name ?? item.raw}</h3>
              {item.quantity > 1 ? <span className="text-sm text-[#d4a574]">×{item.quantity}</span> : null}
            </div>
            {card ? <p className="mt-1 text-xs tracking-[0.14em] text-[#b3a694] uppercase">{printed(card)} · {card.rarity}</p> : null}
          </div>
          <p className="mt-1 text-xs text-[#d4a574]/90">Heard “{item.raw}”</p>
          {item.corrections.map((correction) => (
            <p key={correction} className="text-xs text-[#f3ecdf]/80">{correction}</p>
          ))}
          {item.notes.map((note) => (
            <p key={note} className="mt-1 text-xs leading-snug text-[#b3a694]">{note}</p>
          ))}
          {item.status === "ambiguous" ? <p className="mt-2 text-xs text-[#f3ecdf]">A few printings sit this close. Pick one.</p> : null}
          {item.status === "unmatched" ? <p className="mt-2 text-xs text-[#f3ecdf]">Nothing sat close enough.</p> : null}
          {item.alternatives.length > 0 ? (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {item.alternatives.map((alt) => (
                <Pressable key={alt.id} onClick={() => onChoose(item.key, alt)} className="w-12 shrink-0 rounded-sm text-left">
                  <Image src={alt.small} alt="" width={56} height={78} unoptimized className="rounded-sm" style={{ width: "100%", height: "auto" }} />
                  <span className="mt-1 block truncate text-[10px] text-[#b3a694]">{alt.setCode || alt.number}</span>
                </Pressable>
              ))}
            </div>
          ) : null}
          {card ? (
            <p className="mt-2 text-xs leading-relaxed text-[#b3a694]">
              {[card.supertype, card.subtypes.filter((sub) => sub !== card.supertype).join(" "), card.hp ? `${card.hp} HP` : "", card.types.join(" / "), legal(card), card.regulation ? `Reg ${card.regulation}` : "", card.artist]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {card && auctions && buyNow ? (
            <CardMarket
              card={card}
              modifiers={item.modifiers}
              quote={quote}
              loading={loadingQuotes}
              auctions={auctions}
              buyNow={buyNow}
              pin={pin}
              onPin={onPin}
              filters={filters}
            />
          ) : null}
          <Actions item={item} onInclude={onInclude} onRemove={onRemove} onCopy={onCopy} onSave={onSave} />
        </div>
      </div>
    </li>
  );
}

export function Board({
  items,
  quotes,
  loadingQuotes,
  lanes,
  pins,
  filters,
  onPin,
  onInclude,
  onRemove,
  onChoose,
  onCopy,
  onSave,
  onZoom,
}: {
  items: DeskItem[];
  quotes: Record<string, PriceQuote | null>;
  loadingQuotes: boolean;
  lanes: Record<string, { auctions: ListingLane; buyNow: ListingLane }>;
  pins: Record<string, Pin>;
  filters: Filters;
  onPin: (id: string, pin: Pin) => void;
  onInclude: (key: string, included: boolean) => void;
  onRemove: (key: string) => void;
  onChoose: (key: string, card: PublicCard) => void;
  onCopy: (card: PublicCard) => void;
  onSave: (card: PublicCard) => void;
  onZoom: (card: PublicCard) => void;
}) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => {
        const card = item.card;
        return (
          <CardDesk
            key={item.key}
            item={item}
            quote={card ? quotes[card.id] : undefined}
            loadingQuotes={loadingQuotes}
            lanes={card ? lanes[card.id] : undefined}
            pin={card ? pins[card.id] ?? emptyPin : emptyPin}
            filters={filters}
            onPin={(next) => card && onPin(card.id, next)}
            onInclude={onInclude}
            onRemove={onRemove}
            onChoose={onChoose}
            onCopy={onCopy}
            onSave={onSave}
            onZoom={onZoom}
          />
        );
      })}
    </ul>
  );
}
