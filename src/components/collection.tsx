"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AccountMenu, SiteHeader } from "@/components/account-menu";
import { CardPicture } from "@/components/card-picture";
import { Slab } from "@/components/slab";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/ripple";
import { Skeleton } from "@/components/ui/skeleton";
import { findPrinting, cardHref, printingName } from "@/lib/printing";
import { pickVariant, shownPicture } from "@/lib/facts";
import { useCurrency } from "@/components/currency";
import { finishOf, reverseStamp } from "@/lib/format";
import type { PriceQuote, PublicCard } from "@/lib/types";

type Entry = {
  id: string;
  cardId: string;
  kind: "raw" | "graded";
  company: string | null;
  grade: string | null;
  printing: string | null;
  quantity: number;
  addedAt: number;
  card: PublicCard;
};

type Tab = "all" | "raw" | "graded";

function Tile({ entry, value, onQuantity, onRemove }: { entry: Entry; value: number | null; onQuantity: (entry: Entry, quantity: number) => void; onRemove: (entry: Entry) => void }) {
  const { format } = useCurrency();
  const finish = finishOf(entry.printing);
  const picture = (
    <CardPicture
      src={shownPicture([], entry.printing, finish, entry.card.small, entry.card.large)}
      alt={entry.card.name}
      finish={finish}
      stamp={finish === "reverse" ? reverseStamp(entry.card.setId) : ""}
      width={245}
      height={342}
    />
  );
  return (
    <li className="flex gap-3 rounded-2xl border border-white/10 bg-[#1c1814]/80 p-3">
      <Pressable sameTab href={cardHref(entry.cardId, entry.printing)} className={`block shrink-0 self-start rounded-md ${entry.kind === "graded" ? "w-28 sm:w-32" : "w-20 sm:w-24"}`}>
        {entry.kind === "graded" && entry.company && entry.grade ? (
          <Slab company={entry.company} grade={entry.grade}>
            {picture}
          </Slab>
        ) : (
          picture
        )}
      </Pressable>
      <div className="flex min-w-0 flex-1 flex-col">
        <a href={cardHref(entry.cardId, entry.printing)} className="truncate font-serif text-xl leading-tight hover:underline">
          {entry.card.name}
        </a>
        <p className="mt-0.5 text-xs text-[#b3a694]">
          {entry.card.setName} · {entry.card.number}
          {entry.printing ? ` · ${printingName(entry.printing)}` : ""}
        </p>
        {finish === "reverse" && reverseStamp(entry.card.setId) ? <p className="text-[10px] text-[#b3a694]">Set logo placed on the holo photo.</p> : null}
        <p className="mt-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${entry.kind === "graded" ? "bg-[#d4a574]/25 text-[#ecd0ab]" : "bg-white/10 text-[#f3ecdf]"}`}>
            {entry.kind === "graded" ? `${entry.company} ${entry.grade}` : "Raw"}
          </span>
        </p>
        {value != null ? <p className="mt-2 text-sm text-[#b3a694]">Market {format(value, "USD")} each</p> : null}
        <div className="mt-auto flex items-center gap-2 pt-3">
          <Button type="button" size="sm" variant="outline" aria-label="One fewer" disabled={entry.quantity <= 1} onClick={() => onQuantity(entry, entry.quantity - 1)}>
            −
          </Button>
          <span className="w-6 text-center tabular-nums">{entry.quantity}</span>
          <Button type="button" size="sm" variant="outline" aria-label="One more" onClick={() => onQuantity(entry, entry.quantity + 1)}>
            +
          </Button>
          <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => onRemove(entry)}>
            Remove
          </Button>
        </div>
      </div>
    </li>
  );
}

function choices(entries: Entry[], pick: (entry: Entry) => string): string[] {
  return [...new Set(entries.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function Holdings({
  title,
  blurb,
  endpoint,
  empty,
  signin,
}: {
  title: string;
  blurb: string;
  endpoint: "/api/collection" | "/api/wishlist";
  empty: string;
  signin: string;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [setName, setSetName] = useState("");
  const [year, setYear] = useState("");
  const [artist, setArtist] = useState("");
  const [quotes, setQuotes] = useState<Record<string, PriceQuote | null>>({});

  useEffect(() => {
    let live = true;
    fetch(endpoint)
      .then(async (response) => {
        if (!live) return;
        if (response.status === 401) {
          setError("signin");
          setEntries([]);
          return;
        }
        const payload = (await response.json()) as { entries?: Entry[] };
        if (!response.ok) throw new Error("load");
        setEntries(payload.entries ?? []);
      })
      .catch(() => {
        if (!live) return;
        setError("failed");
        setEntries([]);
      });
    return () => {
      live = false;
    };
  }, [endpoint]);

  const rawIds = useMemo(() => [...new Set((entries ?? []).filter((entry) => entry.kind === "raw").map((entry) => entry.cardId))].slice(0, 80), [entries]);
  const rawKey = rawIds.join(",");
  useEffect(() => {
    if (!rawKey) return;
    let live = true;
    fetch("/api/prices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: rawKey.split(",") }) })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { quotes?: Record<string, PriceQuote | null> } | null) => {
        if (live && payload?.quotes) setQuotes(payload.quotes);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [rawKey]);

  function valueOf(entry: Entry): number | null {
    if (entry.kind !== "raw") return null;
    const variants = quotes[entry.cardId]?.variants ?? [];
    return (findPrinting(variants, entry.printing) ?? pickVariant([], variants))?.market ?? null;
  }

  async function change(entry: Entry, quantity: number) {
    const response = await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: entry.id, quantity }) });
    if (response.ok) setEntries(((await response.json()) as { entries: Entry[] }).entries);
    else toast.error("That didn’t save.");
  }

  async function remove(entry: Entry) {
    const response = await fetch(`${endpoint}?id=${encodeURIComponent(entry.id)}`, { method: "DELETE" });
    if (response.ok) {
      setEntries(((await response.json()) as { entries: Entry[] }).entries);
      toast(`${entry.card.name} removed.`);
    } else toast.error("That didn’t remove.");
  }

  const listed = entries ?? [];
  const sets = choices(listed, (entry) => entry.card.setName);
  const years = choices(listed, (entry) => entry.card.releaseDate.slice(0, 4)).sort((a, b) => b.localeCompare(a));
  const artists = choices(listed, (entry) => entry.card.artist);
  const shown = listed.filter((entry) => {
    if (tab !== "all" && entry.kind !== tab) return false;
    if (setName && entry.card.setName !== setName) return false;
    if (year && !entry.card.releaseDate.startsWith(year)) return false;
    if (artist && entry.card.artist !== artist) return false;
    return true;
  });
  const count = (kind: Tab) => (entries ?? []).filter((entry) => kind === "all" || entry.kind === kind).reduce((sum, entry) => sum + entry.quantity, 0);
  const rawWorth = (entries ?? []).reduce((sum, entry) => sum + (valueOf(entry) ?? 0) * entry.quantity, 0);
  const { format } = useCurrency();

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6">
        <div>
          <h1 className="font-serif text-4xl leading-none tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-2 text-sm text-[#b3a694]">{blurb}</p>
        </div>

        {error === "signin" ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-white/15 p-6">
            <p className="text-[#f3ecdf]">{signin}</p>
            <AccountMenu />
          </div>
        ) : error === "failed" ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-[#b3a694]">{title} didn’t load. Reload to try again.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "raw", "graded"] as const).map((key) => (
                <Button key={key} type="button" size="sm" variant={tab === key ? "default" : "outline"} aria-pressed={tab === key} className="rounded-full" onClick={() => setTab(key)}>
                  {key === "all" ? "All" : key === "raw" ? "Raw" : "Graded"} · {count(key)}
                </Button>
              ))}
              {rawWorth > 0 ? <span className="ml-auto text-sm text-[#b3a694]">Raw copies at market: <span className="font-serif text-xl text-[#f3ecdf]">{format(rawWorth, "USD")}</span></span> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Filter label="Set" value={setName} options={sets} onChange={setSetName} />
              <Filter label="Year" value={year} options={years} onChange={setYear} />
              <Filter label="Artist" value={artist} options={artists} onChange={setArtist} />
            </div>
            {entries === null ? (
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <li key={index}>
                    <Skeleton className="h-40 w-full rounded-2xl bg-white/10" />
                  </li>
                ))}
              </ul>
            ) : shown.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-[#b3a694]">
                {entries.length === 0 ? empty : "Nothing matches these filters."}
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {shown.map((entry) => (
                  <Tile key={entry.id} entry={entry} value={valueOf(entry)} onQuantity={change} onRemove={remove} />
                ))}
              </ul>
            )}
            <p className="text-xs text-[#b3a694]">Graded copies aren’t valued because no free feed publishes graded prices.</p>
          </>
        )}
      </main>
    </div>
  );
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-[#b3a694]">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-8 rounded-full border border-white/15 bg-[#14110e] px-3 text-sm text-[#f3ecdf]">
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CollectionView() {
  return (
    <Holdings
      title="My Collection"
      blurb="Raw and graded copies live side by side. A graded copy shows the company slab with the card inside it."
      endpoint="/api/collection"
      empty="Nothing here yet. Open a card and save a copy to My Collection."
      signin="Sign in with Discord to keep a collection."
    />
  );
}

export function WishlistView() {
  return (
    <Holdings
      title="My Wishlist"
      blurb="Wish for one exact copy: a printing, and a company and grade when you want a slab."
      endpoint="/api/wishlist"
      empty="Nothing here yet. Open a card and save a copy to My Wishlist."
      signin="Sign in with Discord to keep a wishlist."
    />
  );
}
