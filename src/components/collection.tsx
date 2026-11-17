"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AccountMenu, SiteHeader } from "@/components/account-menu";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/ripple";
import { Skeleton } from "@/components/ui/skeleton";
import { findPrinting, cardHref, printingName } from "@/lib/printing";
import { pickVariant } from "@/lib/facts";
import { money } from "@/lib/format";
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
  return (
    <li className="flex gap-3 rounded-2xl border border-white/10 bg-[#1c1814]/80 p-3">
      <Pressable sameTab href={cardHref(entry.cardId, entry.printing)} className="block w-20 shrink-0 self-start rounded-md sm:w-24">
        <Image src={entry.card.small} alt={entry.card.name} width={245} height={342} unoptimized className="rounded-md bg-[#2a241e]" style={{ width: "100%", height: "auto" }} />
      </Pressable>
      <div className="flex min-w-0 flex-1 flex-col">
        <a href={cardHref(entry.cardId, entry.printing)} className="truncate font-serif text-xl leading-tight hover:underline">
          {entry.card.name}
        </a>
        <p className="mt-0.5 text-xs text-[#b3a694]">
          {entry.card.setName} · {entry.card.number}
          {entry.printing ? ` · ${printingName(entry.printing)}` : ""}
        </p>
        <p className="mt-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${entry.kind === "graded" ? "bg-[#d4a574]/25 text-[#ecd0ab]" : "bg-white/10 text-[#f3ecdf]"}`}>
            {entry.kind === "graded" ? `${entry.company} ${entry.grade}` : "Raw"}
          </span>
        </p>
        {value != null ? <p className="mt-2 text-sm text-[#b3a694]">Market {money(value, "USD")} each</p> : null}
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

export function CollectionView() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [quotes, setQuotes] = useState<Record<string, PriceQuote | null>>({});

  useEffect(() => {
    let live = true;
    fetch("/api/collection")
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
  }, []);

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
    const response = await fetch("/api/collection", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: entry.id, quantity }) });
    if (response.ok) setEntries(((await response.json()) as { entries: Entry[] }).entries);
    else toast.error("That didn’t save.");
  }

  async function remove(entry: Entry) {
    const response = await fetch(`/api/collection?id=${encodeURIComponent(entry.id)}`, { method: "DELETE" });
    if (response.ok) {
      setEntries(((await response.json()) as { entries: Entry[] }).entries);
      toast(`${entry.card.name} removed.`);
    } else toast.error("That didn’t remove.");
  }

  const shown = (entries ?? []).filter((entry) => tab === "all" || entry.kind === tab);
  const count = (kind: Tab) => (entries ?? []).filter((entry) => kind === "all" || entry.kind === kind).reduce((sum, entry) => sum + entry.quantity, 0);
  const rawWorth = (entries ?? []).reduce((sum, entry) => sum + (valueOf(entry) ?? 0) * entry.quantity, 0);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6">
        <div>
          <h1 className="font-serif text-4xl leading-none tracking-tight sm:text-5xl">My Collection</h1>
          <p className="mt-2 text-sm text-[#b3a694]">Raw and graded copies live side by side. Add cards from any card page or from the desk.</p>
        </div>

        {error === "signin" ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-white/15 p-6">
            <p className="text-[#f3ecdf]">Sign in with Discord to keep a collection.</p>
            <AccountMenu />
          </div>
        ) : error === "failed" ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-[#b3a694]">My Collection didn’t load. Reload to try again.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "raw", "graded"] as const).map((key) => (
                <Button key={key} type="button" size="sm" variant={tab === key ? "default" : "outline"} aria-pressed={tab === key} className="rounded-full" onClick={() => setTab(key)}>
                  {key === "all" ? "All" : key === "raw" ? "Raw" : "Graded"} · {count(key)}
                </Button>
              ))}
              {rawWorth > 0 ? <span className="ml-auto text-sm text-[#b3a694]">Raw copies at market: <span className="font-serif text-xl text-[#f3ecdf]">{money(rawWorth, "USD")}</span></span> : null}
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
                {entries.length === 0 ? "Nothing here yet. Open a card and choose Add to My Collection." : `No ${tab} cards yet.`}
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
