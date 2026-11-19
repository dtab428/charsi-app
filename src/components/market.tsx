"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/ripple";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/components/currency";
import { buildFeed, COMPANIES, GRADES, type Company, type FeedRow, type FeedSource, type Filters, type SourceFilter } from "@/lib/feed";
import { cardHref, printingSlug } from "@/lib/printing";
import type { ListingLane, Pin, PriceQuote, PublicCard } from "@/lib/types";

const SOURCES: { id: SourceFilter; label: string }[] = [
  { id: "all", label: "All sources" },
  { id: "tcgplayer", label: "TCGplayer" },
  { id: "cardmarket", label: "Cardmarket" },
  { id: "ebay", label: "eBay" },
];

const BADGE: Record<FeedSource, string> = {
  tcgplayer: "TCGplayer",
  cardmarket: "Cardmarket",
  ebay: "eBay",
  scrydex: "Scrydex",
  pin: "Pinned",
};

const BADGE_STYLE: Record<FeedSource, string> = {
  tcgplayer: "bg-[#2f6f9f]/30 text-[#a9d6f5]",
  cardmarket: "bg-[#3f8f6a]/30 text-[#aee3c8]",
  ebay: "bg-[#c9503f]/25 text-[#f5b8ad]",
  scrydex: "bg-[#8a5a2a]/35 text-[#e8c59a]",
  pin: "bg-[#d4a574]/25 text-[#ecd0ab]",
};

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" size="sm" variant={active ? "default" : "outline"} aria-pressed={active} onClick={onClick} className="rounded-full">
      {children}
    </Button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] tracking-[0.14em] text-[#b3a694] uppercase">{label}</span>
      {children}
    </div>
  );
}

export function ConditionControls({
  condition,
  grade,
  onChange,
  label = "Condition",
}: {
  condition: "raw" | Company;
  grade: string;
  onChange: (condition: "raw" | Company, grade: string) => void;
  label?: string;
}) {
  const grades = condition === "raw" ? [] : GRADES[condition];
  function pick(next: "raw" | Company) {
    if (next === "raw") {
      onChange("raw", grade);
      return;
    }
    const allowed = GRADES[next];
    onChange(next, allowed.includes(grade) ? grade : "10");
  }
  return (
    <>
      <Group label={label}>
        <Chip active={condition === "raw"} onClick={() => pick("raw")}>
          Raw
        </Chip>
        {COMPANIES.map((company) => (
          <Chip key={company} active={condition === company} onClick={() => pick(company)}>
            {company}
          </Chip>
        ))}
      </Group>
      {grades.length > 0 ? (
        <Group label="Grade">
          {grades.map((entry) => (
            <Chip key={entry} active={grade === entry} onClick={() => onChange(condition, entry)}>
              {entry}
            </Chip>
          ))}
        </Group>
      ) : null}
    </>
  );
}

export function MarketFilters({ filters, onChange, conditionLabel = "All cards" }: { filters: Filters; onChange: (filters: Filters) => void; conditionLabel?: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#1c1814]/80 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8">
      <Group label="Source">
        {SOURCES.map((source) => (
          <Chip key={source.id} active={filters.source === source.id} onClick={() => onChange({ ...filters, source: source.id })}>
            {source.label}
          </Chip>
        ))}
      </Group>
      <ConditionControls label={conditionLabel} condition={filters.condition} grade={filters.grade} onChange={(condition, grade) => onChange({ ...filters, condition, grade })} />
    </div>
  );
}

function RowView({ row }: { row: FeedRow }) {
  const body = (
    <>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-medium tracking-[0.08em] whitespace-nowrap uppercase ${BADGE_STYLE[row.source]}`}>
        {row.badge ?? BADGE[row.source]}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm text-[#f3ecdf]">{row.label}</span>
        {row.sub ? <span className="block truncate text-xs text-[#b3a694]">{row.sub}</span> : null}
      </span>
      <span className="max-w-[46%] shrink-0 text-right">
        {row.link ? (
          <span className="block text-sm text-[#d4a574]">{row.value} ↗</span>
        ) : (
          <span className="block font-serif text-xl leading-none text-[#f3ecdf]">{row.value}</span>
        )}
        {row.when ? <span className="mt-1 block text-[11px] leading-tight text-[#b3a694]">{row.when}</span> : null}
      </span>
    </>
  );
  const shell = "flex w-full items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5";
  if (row.href) {
    return (
      <Pressable href={row.href} className={`${shell} hover:bg-white/[0.1]`}>
        {body}
      </Pressable>
    );
  }
  return <div className={shell}>{body}</div>;
}

function Section({ title, rows }: { title: string; rows: FeedRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h4 className="mb-1.5 text-[10px] font-medium tracking-[0.16em] text-[#d4a574] uppercase">{title}</h4>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.id}>
            <RowView row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PinEditor({ pin, onPin }: { pin: Pin; onPin: (pin: Pin) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        {pin.price.trim() ? "Edit your pin" : "Pin a price you saw"}
      </Button>
    );
  }
  return (
    <div className="rounded-xl bg-white/[0.06] p-3">
      <div className="flex flex-wrap gap-1.5">
        {(["facebook", "discord", "other"] as const).map((source) => (
          <Chip key={source} active={pin.source === source} onClick={() => onPin({ ...pin, source })}>
            {source === "facebook" ? "Facebook" : source === "discord" ? "Discord" : "Other"}
          </Chip>
        ))}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Input value={pin.price} onChange={(event) => onPin({ ...pin, price: event.target.value.slice(0, 40) })} placeholder="Asking price" aria-label="Asking price" />
        <Input value={pin.note} onChange={(event) => onPin({ ...pin, note: event.target.value.slice(0, 80) })} placeholder="What they said" aria-label="What they said" />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-[#b3a694]">Typed by hand and cleared on reload. Charsi doesn’t read Marketplace or Discord yet.</p>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
          Done
        </Button>
      </div>
    </div>
  );
}

export function CardMarket({
  card,
  modifiers,
  quote,
  loading,
  auctions,
  buyNow,
  pin,
  onPin,
  filters,
  variantKey,
  hideDetailsLink,
}: {
  card: PublicCard;
  modifiers: string[];
  quote: PriceQuote | null | undefined;
  loading: boolean;
  auctions: ListingLane;
  buyNow: ListingLane;
  pin: Pin;
  onPin: (pin: Pin) => void;
  filters: Filters;
  variantKey: string | null;
  hideDetailsLink?: boolean;
}) {
  const [showMore, setShowMore] = useState(false);
  const { format } = useCurrency();
  const feed = useMemo(
    () => buildFeed({ card, modifiers, quote, variantKey, auctions, buyNow, pin, filters, format }),
    [card, modifiers, quote, variantKey, auctions, buyNow, pin, filters, format],
  );


  if (quote === undefined && loading) {
    return (
      <div className="mt-4 flex flex-col gap-1.5" aria-busy="true" aria-label="Loading prices">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-[3.4rem] w-full rounded-xl bg-white/10" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {!hideDetailsLink ? (
        <div>
          <Pressable sameTab href={cardHref(card.id, variantKey ? printingSlug(variantKey) : null)} className="inline-flex items-center rounded-full border border-white/15 px-3 py-1.5 text-xs text-[#f3ecdf] hover:bg-white/10">
            Open card page
          </Pressable>
        </div>
      ) : null}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section title="Ended recently" rows={feed.ended} />
        <Section title="Live now" rows={feed.live} />
      </div>
      {feed.empty ? <p className="rounded-xl bg-white/[0.06] px-3 py-3 text-sm text-[#b3a694]">{feed.empty}</p> : null}
      {feed.notice ? <p className="rounded-xl border border-dashed border-white/15 px-3 py-3 text-xs leading-relaxed text-[#b3a694]">{feed.notice}</p> : null}
      {feed.more.length > 0 ? (
        <div>
          <Button type="button" size="sm" variant="ghost" aria-expanded={showMore} onClick={() => setShowMore((value) => !value)}>
            {showMore ? "Hide extra detail" : `Extra detail (${feed.more.length})`}
          </Button>
          {showMore ? (
            <div className="mt-2">
              <Section title="More" rows={feed.more} />
            </div>
          ) : null}
        </div>
      ) : null}
      {filters.condition === "raw" && filters.source === "all" ? <PinEditor pin={pin} onPin={onPin} /> : null}
    </div>
  );
}
