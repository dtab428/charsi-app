"use client";

import { CardPicture } from "@/components/card-picture";
import { Slab } from "@/components/slab";
import { Button } from "@/components/ui/button";
import { AddToCollection } from "@/components/add-to-collection";
import { HoldingToggles } from "@/components/holding-toggles";
import { CardMarket, ConditionControls } from "@/components/market";
import { PrintingPicker } from "@/components/printing-picker";
import { Pressable } from "@/components/ui/ripple";
import { useEffect, useRef, useState } from "react";
import { mergePrintings, printingFamily, resolveActive, shownPicture } from "@/lib/facts";
import { coversEditionStamp, editionOf, finishOf, releaseYear, reverseStamp, variantLabel, type Finish } from "@/lib/format";
import { cardHref, printingSlug } from "@/lib/printing";
import { COMPANIES, GRADES, type Company, type Filters } from "@/lib/feed";
import { emptyLane } from "@/lib/links";
import type { Wear } from "@/lib/wear";
import type { ListingLane, Pin, PriceQuote, PublicCard, ResolveItem } from "@/lib/types";

export type View = { condition: "all" | "raw" | Company; grade: string; wear: Wear | "any" };

export type ZoomShot = { card: PublicCard; src: string; finish: Finish | null; stamp: string; badge: boolean };

export type DeskItem = ResolveItem & { key: string; slot: number; included: boolean; picked: string | null; view: View | null };

const emptyPin: Pin = { source: "discord", price: "", note: "" };

function printed(card: PublicCard): string {
  const number = card.printedTotal ? `${card.number}/${card.printedTotal}` : card.number;
  const year = releaseYear(card.releaseDate);
  return [card.setName, year, number].filter(Boolean).join(" · ");
}

function legal(card: PublicCard): string {
  if (card.standard === "Legal") return "Standard";
  if (card.expanded === "Legal") return "Expanded";
  if (card.standard === "Banned") return "Not Standard";
  return "";
}

function typedView(grading: DeskItem["grading"]): View | null {
  if (!grading) return null;
  const company = COMPANIES.find((entry) => entry === grading.company);
  if (!company) return null;
  const allowed = GRADES[company];
  if (grading.grade === null) return { condition: company, grade: allowed[0] ?? "10", wear: "NM" };
  const wanted = Number(grading.grade);
  const nearest = allowed.includes(grading.grade) ? grading.grade : allowed.slice().sort((a, b) => Math.abs(Number(a) - wanted) - Math.abs(Number(b) - wanted))[0];
  return { condition: company, grade: nearest ?? "10", wear: "NM" };
}

function Face({
  card,
  src,
  finish,
  badge,
  slab,
  onZoom,
}: {
  card: PublicCard;
  src: string;
  finish: ReturnType<typeof finishOf>;
  badge: boolean;
  slab: { company: string; grade: string } | null;
  onZoom: (shot: ZoomShot) => void;
}) {
  const stamp = finish === "reverse" ? reverseStamp(card.setId) : "";
  const picture = <CardPicture src={src} alt={card.name} finish={finish} badge={badge} stamp={stamp} width={245} height={342} />;
  return (
    <Pressable onClick={() => onZoom({ card, src, finish, stamp, badge })} className="block w-full rounded-md text-left">
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
      {item.card ? <AddToCollection key={`${filters.condition}-${filters.grade}-${filters.wear}-${printing ?? ""}`} card={item.card} printing={printing} initialCondition={filters.condition} initialGrade={filters.grade} initialWear={filters.wear} /> : null}
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
  onPick,
  onView,
  onCopy,
  onSave,
  onZoom,
  columns,
  quotes,
}: {
  item: DeskItem;
  quote: PriceQuote | null | undefined;
  quotes: Record<string, PriceQuote | null>;
  loadingQuotes: boolean;
  lanes: { auctions: ListingLane; buyNow: ListingLane } | undefined;
  pin: Pin;
  filters: Filters;
  onPin: (pin: Pin) => void;
  onInclude: (key: string, included: boolean) => void;
  onRemove: (key: string) => void;
  onChoose: (key: string, card: PublicCard) => void;
  onPick: (key: string, cardId: string, variantKey: string) => void;
  onView: (key: string, view: View) => void;
  onCopy: (card: PublicCard) => void;
  onSave: (card: PublicCard) => void;
  onZoom: (shot: ZoomShot) => void;
  columns: 1 | 2;
}) {
  const card = item.card;
  const pickedKey = item.picked;
  const family = card ? printingFamily(card, item.alternatives) : [];
  const outside = item.alternatives.filter((alt) => !family.some((member) => member.id === alt.id));
  const printings = mergePrintings(
    family.map((member) => ({
      cardId: member.id,
      variants: quotes[member.id]?.variants ?? [],
    })),
  );
  const loaded = family.length > 0 && family.every((member) => quotes[member.id] !== undefined);
  const [useTyped, setUseTyped] = useState(true);
  const seen = useRef(`${filters.condition}-${filters.grade}-${filters.wear}`);
  useEffect(() => {
    const now = `${filters.condition}-${filters.grade}-${filters.wear}`;
    if (seen.current === now) return;
    seen.current = now;
    setUseTyped(false);
  }, [filters.condition, filters.grade, filters.wear]);
  const view = item.view ?? (useTyped ? typedView(item.grading) : null) ?? { condition: filters.condition, grade: filters.grade, wear: filters.wear };
  const cardFilters: Filters = { ...filters, condition: view.condition, grade: view.grade, wear: view.wear };
  const active = resolveActive({ finish: item.finish, modifiers: item.modifiers, variants: printings, pickedKey, pickedCardId: card?.id, loaded });
  const activeKey = active.key;
  const shown = family.find((member) => member.id === (active.cardId ?? card?.id)) ?? card;
  const shownQuote = shown ? quotes[shown.id] : quote;
  const waiting = !pickedKey && family.some((member) => quotes[member.id] === undefined);
  const unsettled = (item.status === "ambiguous" || item.status === "unmatched") && outside.length > 0;
  const hold = !unsettled && (active.needsPick || waiting);
  const dim = hold ? "pointer-events-none opacity-30 transition-opacity select-none" : "transition-opacity";
  const printing = activeKey ? printingSlug(activeKey) : null;
  const finish = finishOf(activeKey);
  const asking = !unsettled && !pickedKey && (active.needsPick || (waiting && family.length > 1));
  const picture = shown ? shownPicture(shownQuote?.variants ?? printings, activeKey, finish, shown.small, shown.large, active.cardId) : "";
  const auctions = shown ? lanes?.auctions ?? emptyLane(shown, "auction") : null;
  const buyNow = shown ? lanes?.buyNow ?? emptyLane(shown, "bin") : null;

  return (
    <li className="rounded-[24px] border border-white/10 bg-[#1c1814]/80 p-3 sm:p-5">
      <div className="flex gap-3 sm:gap-5">
        <div inert={hold} className={`${dim} ${columns === 2 ? "w-24 shrink-0 self-start sm:w-32" : "w-24 shrink-0 self-start sm:w-40 lg:w-48"}`}>
          {shown ? (
            <div>
              <Face card={shown} src={picture} finish={finish} badge={printings.length > 1} slab={view.condition === "raw" || view.condition === "all" ? null : { company: view.condition, grade: view.grade }} onZoom={onZoom} />
              {finish === "reverse" && reverseStamp(shown.setId) ? <p className="mt-1 text-center text-[10px] leading-tight text-[#b3a694]">Set logo placed on the holo photo.</p> : null}
            </div>
          ) : (
            <div className="flex aspect-[63/88] items-end rounded-md border border-dashed border-white/15 p-2 text-xs text-[#b3a694]">{item.raw}</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="min-w-0 font-serif text-2xl leading-none tracking-tight sm:text-3xl">
                {shown ? (
                  <a href={cardHref(shown.id, printing)} className="hover:underline">
                    {shown.name}
                  </a>
                ) : (
                  item.raw
                )}
              </h3>
              {item.quantity > 1 ? <span className="text-sm text-[#d4a574]">×{item.quantity}</span> : null}
              {shown ? <span className="ml-auto"><HoldingToggles cardId={shown.id} printing={printing} condition={view.condition} grade={view.grade} wear={view.wear} /></span> : null}
            </div>
            {shown ? (
              <p className="mt-1 text-xs text-[#b3a694]">
                {asking ? `${printed(shown)} · which printing?` : `${printed(shown)} · ${printings.length > 1 && activeKey ? variantLabel(activeKey) : shown.rarity}`}
              </p>
            ) : null}
            {coversEditionStamp(activeKey) ? <p className="mt-1 text-xs leading-snug text-[#b3a694]">{editionOf(activeKey) === "shadowless" ? "Shadowless" : "Unlimited"} has no Edition 1 stamp, so it’s covered on this photo.</p> : null}
          </div>
          <p className="mt-1 text-xs text-[#d4a574]/90">Heard “{item.raw}”</p>
          {item.corrections.map((correction) => (
            <p key={correction} className="text-xs text-[#f3ecdf]/80">{correction}</p>
          ))}
          {item.notes.map((note) => (
            <p key={note} className="mt-1 text-xs leading-snug text-[#b3a694]">{note}</p>
          ))}
          {item.status === "ambiguous" && outside.length > 0 ? <p className="mt-2 text-xs text-[#f3ecdf]">A few cards match. Pick the one you meant.</p> : null}
          {item.status === "unmatched" ? <p className="mt-2 text-xs text-[#f3ecdf]">Nothing sat close enough.</p> : null}
          {(item.status === "ambiguous" || item.status === "unmatched") && outside.length > 0 ? (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {outside.map((alt) => (
                <Pressable key={alt.id} onClick={() => onChoose(item.key, alt)} className="w-28 shrink-0 rounded-sm text-left">
                  <CardPicture src={alt.small} alt="" finish={null} width={56} height={78} className="rounded-sm bg-[#2a241e]" />
                  <span className="mt-1 block text-[10px] leading-tight text-[#b3a694]">
                    {alt.setName}
                    <br />
                    {alt.printedTotal ? `${alt.number}/${alt.printedTotal}` : alt.number}
                    {alt.rarity ? ` · ${alt.rarity}` : ""}
                  </span>
                </Pressable>
              ))}
            </div>
          ) : null}
          {shown ? (
            <p inert={hold} className={`mt-2 text-xs leading-relaxed text-[#b3a694] ${dim}`}>
              {[shown.supertype, shown.subtypes.filter((sub) => sub !== shown.supertype).join(" "), shown.hp ? `${shown.hp} HP` : "", shown.types.join(" / "), legal(shown), shown.regulation ? `Reg ${shown.regulation}` : "", shown.artist]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {asking && waiting ? (
            <div className="mt-4 rounded-2xl border-2 border-[#f0d7a4] bg-[#2a2216] p-4">
              <p className="font-serif text-xl italic text-[#f3ecdf]">Which printing do you mean?</p>
              <p className="mt-1 text-xs leading-relaxed text-[#d8c9ab]">
                Checking {family.map((member) => (member.printedTotal ? `${member.number}/${member.printedTotal}` : member.number)).join(" and ")}. The price depends on which one this is.
              </p>
            </div>
          ) : null}
          {waiting && !asking ? <p className="mt-4 text-xs text-[#b3a694]">Checking the price.</p> : null}
          {!unsettled && card && printings.length > 0 && !waiting ? (
            <div className="mt-4">
              <PrintingPicker
                variants={printings}
                activeKey={activeKey}
                activeCardId={shown?.id ?? null}
                needsPick={active.needsPick}
                missing={active.missing}
                stamped={Boolean(reverseStamp(card.setId))}
                captionFor={(entry) => {
                  if (family.length < 2) return "";
                  const owner = family.find((member) => member.id === entry.cardId);
                  if (!owner) return "";
                  return owner.printedTotal ? `${owner.number}/${owner.printedTotal}` : owner.number;
                }}
                onPick={(cardId, variantKey) => onPick(item.key, cardId, variantKey)}
              />
            </div>
          ) : null}
          {shown && !hold ? (
            <div>
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8">
                <ConditionControls
                  label="This card"
                  condition={view.condition}
                  grade={view.grade}
                  wear={view.wear}
                  onChange={(condition, grade) => onView(item.key, { condition, grade, wear: condition === "raw" ? view.wear : "any" })}
                  onWear={(wear) => onView(item.key, { condition: "raw", grade: view.grade, wear })}
                />
              </div>
              {auctions && buyNow ? (
                <CardMarket
                  card={shown}
                  modifiers={item.modifiers}
                  quote={shownQuote ?? null}
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
          <div inert={hold} className={dim}>
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
  onPick,
  onView,
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
  onPick: (key: string, cardId: string, variantKey: string) => void;
  onView: (key: string, view: View) => void;
  onCopy: (card: PublicCard) => void;
  onSave: (card: PublicCard) => void;
  onZoom: (shot: ZoomShot) => void;
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
            quotes={quotes}
            loadingQuotes={loadingQuotes}
            lanes={card ? lanes[card.id] : undefined}
            pin={card ? pins[card.id] ?? emptyPin : emptyPin}
            filters={filters}
            onPin={(next) => card && onPin(card.id, next)}
            onInclude={onInclude}
            onRemove={onRemove}
            onChoose={onChoose}
            onPick={onPick}
            onView={onView}
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
