"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { MarketTickets } from "@/components/tickets";
import { cardFacts } from "@/lib/facts";
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
        src={card.small || card.large}
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

function CardDesk({
  item,
  open,
  quote,
  loadingQuotes,
  lanes,
  pin,
  onOpen,
  onPin,
  onInclude,
  onRemove,
  onChoose,
  onCopy,
  onSave,
  onZoom,
}: {
  item: DeskItem;
  open: boolean;
  quote: PriceQuote | null | undefined;
  loadingQuotes: boolean;
  lanes: { auctions: ListingLane; buyNow: ListingLane } | undefined;
  pin: Pin;
  onOpen: (key: string | null) => void;
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
  const facts = card && auctions && buyNow ? cardFacts(card, item.modifiers, quote, loadingQuotes, auctions, buyNow, pin) : [];

  return (
    <li className="rounded-[24px] border border-white/10 bg-[#1c1814]/80 p-3 sm:p-4">
      <div className="flex gap-3 sm:gap-4">
        <div className="w-16 shrink-0 sm:w-[5.5rem]">
          {card ? <Face card={card} onZoom={onZoom} /> : (
            <div className="flex aspect-[63/88] items-end rounded-md border border-dashed border-white/15 p-2 text-xs text-[#b3a694]">{item.raw}</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <h3 className="font-serif text-2xl leading-none tracking-tight">{card?.name ?? item.raw}</h3>
                {item.quantity > 1 ? <span className="text-sm text-[#d4a574]">×{item.quantity}</span> : null}
              </div>
              {card ? <p className="mt-1 text-xs tracking-[0.14em] text-[#b3a694] uppercase">{printed(card)} · {card.rarity}</p> : null}
            </div>
            {card ? (
              <Button type="button" size="sm" variant={open ? "secondary" : "outline"} aria-expanded={open} onClick={() => onOpen(open ? null : item.key)}>
                {open ? "Hide the market" : "Open the market"}
              </Button>
            ) : null}
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
                <button key={alt.id} type="button" onClick={() => onChoose(item.key, alt)} className="w-12 shrink-0 text-left">
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
          {facts.length > 0 && !open ? (
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {facts.map((fact) => (
                <li key={fact.id} className="min-w-0">
                  {fact.href ? (
                    <a href={fact.href} target="_blank" rel="noreferrer" className="block h-full rounded-xl bg-[#f4efe4] px-2.5 py-2 text-[#241c14] hover:bg-[#fffaf1]">
                      <FactBody kicker={fact.kicker} value={fact.value} detail={fact.detail} />
                    </a>
                  ) : (
                    <div className="h-full rounded-xl bg-[#f4efe4] px-2.5 py-2 text-[#241c14]">
                      <FactBody kicker={fact.kicker} value={fact.value} detail={fact.detail} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          <Actions item={item} onInclude={onInclude} onRemove={onRemove} onCopy={onCopy} onSave={onSave} />
        </div>
      </div>
      {open && card && auctions && buyNow ? (
        <div className="mt-4">
          <div className="xl:hidden">
            <MarketTickets
              layout="stack"
              card={card}
              modifiers={item.modifiers}
              quote={quote}
              loading={loadingQuotes}
              auctions={auctions}
              buyNow={buyNow}
              pin={pin}
              onPin={onPin}
            />
          </div>
          <div className="relative hidden h-[680px] xl:block">
            <div className="absolute top-1/2 left-1/2 z-10 w-[190px] -translate-x-1/2 -translate-y-1/2">
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
            </div>
            <MarketTickets
              layout="orbit"
              card={card}
              modifiers={item.modifiers}
              quote={quote}
              loading={loadingQuotes}
              auctions={auctions}
              buyNow={buyNow}
              pin={pin}
              onPin={onPin}
            />
          </div>
        </div>
      ) : null}
    </li>
  );
}

function FactBody({ kicker, value, detail }: { kicker: string; value: string; detail: string }) {
  return (
    <>
      <p className="text-[10px] font-medium tracking-[0.14em] text-[#8a5a2a] uppercase">{kicker}</p>
      <p className="mt-1 truncate font-serif text-xl leading-none">{value}</p>
      <p className="mt-1 truncate text-[11px] text-[#241c14]/65">{detail}</p>
    </>
  );
}

export function Board({
  items,
  openKey,
  quotes,
  loadingQuotes,
  lanes,
  pins,
  onOpen,
  onPin,
  onInclude,
  onRemove,
  onChoose,
  onCopy,
  onSave,
  onZoom,
}: {
  items: DeskItem[];
  openKey: string | null;
  quotes: Record<string, PriceQuote | null>;
  loadingQuotes: boolean;
  lanes: Record<string, { auctions: ListingLane; buyNow: ListingLane }>;
  pins: Record<string, Pin>;
  onOpen: (key: string | null) => void;
  onPin: (id: string, pin: Pin) => void;
  onInclude: (key: string, included: boolean) => void;
  onRemove: (key: string) => void;
  onChoose: (key: string, card: PublicCard) => void;
  onCopy: (card: PublicCard) => void;
  onSave: (card: PublicCard) => void;
  onZoom: (card: PublicCard) => void;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const card = item.card;
        return (
          <CardDesk
            key={item.key}
            item={item}
            open={openKey === item.key}
            quote={card ? quotes[card.id] : undefined}
            loadingQuotes={loadingQuotes}
            lanes={card ? lanes[card.id] : undefined}
            pin={card ? pins[card.id] ?? emptyPin : emptyPin}
            onOpen={onOpen}
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
