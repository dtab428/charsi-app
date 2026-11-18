"use client";

import { CardPicture } from "@/components/card-picture";
import { Slab } from "@/components/slab";
import { Button } from "@/components/ui/button";
import { AddToCollection } from "@/components/add-to-collection";
import { CardMarket, ConditionControls } from "@/components/market";
import { PrintingPicker } from "@/components/printing-picker";
import { Pressable } from "@/components/ui/ripple";
import { useEffect, useRef, useState } from "react";
import { resolveActive } from "@/lib/facts";
import { finishOf } from "@/lib/format";
import { cardHref, printingSlug } from "@/lib/printing";
import { COMPANIES, GRADES, type Company, type Filters } from "@/lib/feed";
import { emptyLane } from "@/lib/links";
import type { ListingLane, Pin, PriceQuote, PublicCard, ResolveItem } from "@/lib/types";

export type DeskItem = ResolveItem & { key: string; included: boolean };

const emptyPin: Pin = { source: "discord", price: "", note: "" };

function printed(card: PublicCard): string {
  const number = card.printedTotal ? `${card.number}/${card.printedTotal}` : card.number;
  return `${card.setName} · ${number}`;
}

function legal(card: PublicCard): string {
  if (card.standard === "Legal") return "Standard";
  if (card.expanded === "Legal") return "Expanded";
  if (card.standard === "Banned") return "Not Standard";
  return "Unlimited";
}

type View = { condition: "raw" | Company; grade: string };

function typedView(grading: DeskItem["grading"]): View | null {
  if (!grading) return null;
  const company = COMPANIES.find((entry) => entry === grading.company);
  if (!company) return null;
  const allowed = GRADES[company];
  if (grading.grade === null) return { condition: company, grade: allowed[0] ?? "10" };
  const wanted = Number(grading.grade);
  const nearest = allowed.slice().sort((a, b) => Math.abs(Number(a) - wanted) - Math.abs(Number(b) - wanted))[0];
  return { condition: company, grade: nearest ?? "10" };
}

function Face({
  card,
  src,
  finish,
  slab,
  onZoom,
}: {
  card: PublicCard;
  src: string;
  finish: ReturnType<typeof finishOf>;
  slab: { company: string; grade: string } | null;
  onZoom: (card: PublicCard) => void;
}) {
  const picture = <CardPicture src={src} alt={card.name} finish={finish} stamp={card.setCode || card.setName} width={245} height={342} />;
  return (
    <Pressable onClick={() => onZoom(card)} className="block w-full rounded-md text-left">
      {slab ? (
        <Slab company={slab.company} grade={slab.grade}>
          {picture}
        </Slab>
      ) : (
        picture
      )}
    </Pressable>
  );
}

function Actions({
  item,
  onInclude,
  onRemove,
  onCopy,
  onSave,
  printing,
  filters,
}: {
  item: DeskItem;
  onInclude: (key: string, included: boolean) => void;
  onRemove: (key: string) => void;
  onCopy: (card: PublicCard) => void;
  onSave: (card: PublicCard) => void;
  printing: string | null;
  filters: Filters;
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
      {item.card ? <AddToCollection key={`${filters.condition}-${filters.grade}-${printing ?? ""}`} card={item.card} printing={printing} initialCondition={filters.condition} initialGrade={filters.grade} /> : null}
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
  columns,
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
  columns: 1 | 2;
}) {
  const card = item.card;
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [own, setOwn] = useState<View | null>(null);
  const [useTyped, setUseTyped] = useState(true);
  const seen = useRef(`${filters.condition}-${filters.grade}`);
  useEffect(() => {
    const now = `${filters.condition}-${filters.grade}`;
    if (seen.current === now) return;
    seen.current = now;
    setOwn(null);
    setUseTyped(false);
  }, [filters.condition, filters.grade]);
  const view = own ?? (useTyped ? typedView(item.grading) : null) ?? { condition: filters.condition, grade: filters.grade };
  const cardFilters: Filters = { ...filters, condition: view.condition, grade: view.grade };
  const active = resolveActive({ finish: item.finish, modifiers: item.modifiers, variants: quote?.variants ?? [], pickedKey, loaded: Boolean(quote) });
  const activeKey = active.key;
  const dim = active.needsPick ? "pointer-events-none opacity-30 transition-opacity select-none" : "transition-opacity";
  const printing = activeKey ? printingSlug(activeKey) : null;
  const finish = finishOf(activeKey);
  const picture = (card && quote && quote.variants.find((entry) => entry.key === activeKey)?.image) || card?.small || card?.large || "";
  const auctions = card ? lanes?.auctions ?? emptyLane(card, "auction") : null;
  const buyNow = card ? lanes?.buyNow ?? emptyLane(card, "bin") : null;

  return (
    <li className="rounded-[24px] border border-white/10 bg-[#1c1814]/80 p-3 sm:p-5">
      <div className="flex gap-3 sm:gap-5">
        <div inert={active.needsPick} className={`${dim} ${columns === 2 ? "w-24 shrink-0 self-start sm:w-32" : "w-24 shrink-0 self-start sm:w-40 lg:w-48"}`}>
          {card ? (
            <div>
              <Face card={card} src={picture} finish={finish} slab={view.condition === "raw" ? null : { company: view.condition, grade: view.grade }} onZoom={onZoom} />
              {finish === "reverse" ? <p className="mt-1 text-center text-[10px] leading-tight text-[#b3a694]">Placed stamp. Not a photo of the stamped card.</p> : null}
            </div>
          ) : (
            <div className="flex aspect-[63/88] items-end rounded-md border border-dashed border-white/15 p-2 text-xs text-[#b3a694]">{item.raw}</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="font-serif text-2xl leading-none tracking-tight sm:text-3xl">
                {card ? (
                  <a href={cardHref(card.id, printing)} className="hover:underline">
                    {card.name}
                  </a>
                ) : (
                  item.raw
                )}
              </h3>
              {item.quantity > 1 ? <span className="text-sm text-[#d4a574]">×{item.quantity}</span> : null}
            </div>
            {card ? <p className="mt-1 text-xs text-[#b3a694]">{printed(card)} · {card.rarity}</p> : null}
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
                <Pressable key={alt.id} onClick={() => onChoose(item.key, alt)} className="w-24 shrink-0 rounded-sm text-left">
                  <CardPicture src={alt.small} alt="" finish={null} width={56} height={78} className="rounded-sm bg-[#2a241e]" />
                  <span className="mt-1 block text-[10px] leading-tight text-[#b3a694]">{alt.setName}</span>
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
          {card && quote ? (
            <div className="mt-4">
              <PrintingPicker variants={quote.variants} activeKey={activeKey} needsPick={active.needsPick} missing={active.missing} onPick={setPickedKey} />
            </div>
          ) : null}
          {card && !active.needsPick ? (
            <div>
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8">
                <ConditionControls label="This card" condition={view.condition} grade={view.grade} onChange={(condition, grade) => setOwn({ condition, grade })} />
              </div>
              {auctions && buyNow ? (
                <CardMarket
                  card={card}
                  modifiers={item.modifiers}
                  quote={quote}
                  loading={loadingQuotes}
                  auctions={auctions}
                  buyNow={buyNow}
                  pin={pin}
                  onPin={onPin}
                  filters={cardFilters}
                  variantKey={activeKey}
                />
              ) : null}
            </div>
          ) : null}
          <div inert={active.needsPick} className={dim}>
            <Actions item={item} onInclude={onInclude} onRemove={onRemove} onCopy={onCopy} onSave={onSave} printing={printing} filters={cardFilters} />
          </div>
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
  columns,
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
  columns: 1 | 2;
}) {
  return (
    <ul className={columns === 2 ? "grid items-start gap-4 xl:grid-cols-2" : "flex flex-col gap-4"}>
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
            columns={columns}
          />
        );
      })}
    </ul>
  );
}
