"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { MarketTickets } from "@/components/tickets";
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
    <button type="button" onClick={() => onZoom(card)} className="block w-full text-left">
      <Image
        src={card.large || card.small}
        alt={card.name}
        width={245}
        height={342}
        unoptimized
        className="rounded-md bg-[#2a241e]"
        style={{ width: "100%", height: "auto" }}
      />
    </button>
  );
}

function Caption({
  item,
  onChoose,
}: {
  item: DeskItem;
  onChoose: (key: string, card: PublicCard) => void;
}) {
  const card = item.card;
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-serif text-2xl leading-none tracking-tight">{card?.name ?? item.raw}</h3>
        {item.quantity > 1 ? <span className="text-sm text-[#d4a574]">×{item.quantity}</span> : null}
      </div>
      {card ? <p className="mt-1 text-xs tracking-[0.14em] text-[#b3a694] uppercase">{printed(card)} · {card.rarity}</p> : null}
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
            <button key={alt.id} type="button" onClick={() => onChoose(item.key, alt)} className="w-14 shrink-0 text-left">
              <Image src={alt.small} alt="" width={56} height={78} unoptimized className="rounded-sm" style={{ width: "100%", height: "auto" }} />
              <span className="mt-1 block truncate text-[10px] text-[#b3a694]">{alt.setCode || alt.number}</span>
            </button>
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
    </div>
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
    <div className="mt-3 flex flex-wrap gap-2">
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

export function Board({
  items,
  surround,
  quotes,
  loadingQuotes,
  lanes,
  pins,
  onPin,
  onInclude,
  onRemove,
  onChoose,
  onCopy,
  onSave,
  onZoom,
}: {
  items: DeskItem[];
  surround: boolean;
  quotes: Record<string, PriceQuote | null>;
  loadingQuotes: boolean;
  lanes: Record<string, { auctions: ListingLane; buyNow: ListingLane }>;
  pins: Record<string, Pin>;
  onPin: (id: string, pin: Pin) => void;
  onInclude: (key: string, included: boolean) => void;
  onRemove: (key: string) => void;
  onChoose: (key: string, card: PublicCard) => void;
  onCopy: (card: PublicCard) => void;
  onSave: (card: PublicCard) => void;
  onZoom: (card: PublicCard) => void;
}) {
  if (!surround) {
    return (
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.key}>
            {item.card ? <Face card={item.card} onZoom={onZoom} /> : (
              <div className="flex aspect-[63/88] items-end rounded-md border border-dashed border-white/15 p-3 text-sm text-[#b3a694]">{item.raw}</div>
            )}
            <Caption item={item} onChoose={onChoose} />
            <Actions item={item} onInclude={onInclude} onRemove={onRemove} onCopy={onCopy} onSave={onSave} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="flex flex-col gap-10">
      {items.map((item) => {
        const card = item.card;
        const pin = card ? pins[card.id] ?? emptyPin : emptyPin;
        const lane = card ? lanes[card.id] : undefined;
        return (
          <li key={item.key} className="rounded-[28px] border border-white/10 bg-[#1c1814]/80 p-4 sm:p-6">
            <div className="xl:hidden">
              <div className="mx-auto max-w-[240px]">{card ? <Face card={card} onZoom={onZoom} /> : null}</div>
              <Caption item={item} onChoose={onChoose} />
              <Actions item={item} onInclude={onInclude} onRemove={onRemove} onCopy={onCopy} onSave={onSave} />
              {card ? (
                <div className="mt-4">
                  <MarketTickets
                    layout="stack"
                    card={card}
                    modifiers={item.modifiers}
                    quote={quotes[card.id]}
                    loading={loadingQuotes}
                    auctions={lane?.auctions ?? emptyLane(card, "auction")}
                    buyNow={lane?.buyNow ?? emptyLane(card, "bin")}
                    pin={pin}
                    onPin={(next) => onPin(card.id, next)}
                  />
                </div>
              ) : null}
            </div>
            <div className="hidden xl:block">
              <div className="relative h-[680px]">
                {card ? (
                  <div className="absolute top-1/2 left-1/2 z-10 w-[190px] -translate-x-1/2 -translate-y-1/2">
                    <Face card={card} onZoom={onZoom} />
                  </div>
                ) : (
                  <div className="absolute top-1/2 left-1/2 z-10 w-56 -translate-x-1/2 -translate-y-1/2 rounded-md border border-dashed border-white/15 p-3 text-sm text-[#b3a694]">
                    {item.raw}
                  </div>
                )}
                {card ? (
                  <MarketTickets
                    layout="orbit"
                    card={card}
                    modifiers={item.modifiers}
                    quote={quotes[card.id]}
                    loading={loadingQuotes}
                    auctions={lane?.auctions ?? emptyLane(card, "auction")}
                    buyNow={lane?.buyNow ?? emptyLane(card, "bin")}
                    pin={pin}
                    onPin={(next) => onPin(card.id, next)}
                  />
                ) : null}
              </div>
              <div className="mx-auto max-w-xl">
                <Caption item={item} onChoose={onChoose} />
                <Actions item={item} onInclude={onInclude} onRemove={onRemove} onCopy={onCopy} onSave={onSave} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
