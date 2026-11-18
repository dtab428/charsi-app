"use client";

import Link from "next/link";
import { CardPicture } from "@/components/card-picture";
import { Slab } from "@/components/slab";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/account-menu";
import { HoldingsProvider, HoldingToggles } from "@/components/holding-toggles";
import { AddToCollection } from "@/components/add-to-collection";
import { CardMarket, MarketFilters } from "@/components/market";
import { PriceChart, type ChartPoint } from "@/components/price-chart";
import { PrintingPicker } from "@/components/printing-picker";
import { resolveActive, saleAverages } from "@/lib/facts";
import { DEFAULT_FILTERS, type Filters } from "@/lib/feed";
import { finishOf, finishRank, quoteDate, variantLabel } from "@/lib/format";
import { emptyLane } from "@/lib/links";
import { cardHref, findPrinting, printingSlug } from "@/lib/printing";
import type { Snapshot } from "@/lib/history";
import type { ListingLane, Pin, PriceQuote, PublicCard } from "@/lib/types";

const NO_PIN: Pin = { source: "discord", price: "", note: "" };

function facts(card: PublicCard): [string, string][] {
  const rows: [string, string][] = [
    ["Set", `${card.setName}${card.series ? ` (${card.series})` : ""}`],
    ["Number", card.printedTotal ? `${card.number}/${card.printedTotal}` : card.number],
    ["Rarity", card.rarity || "—"],
    ["Type", [card.supertype, ...card.subtypes.filter((sub) => sub !== card.supertype)].join(" · ")],
  ];
  if (card.hp) rows.push(["HP", card.hp]);
  if (card.types.length) rows.push(["Energy", card.types.join(" / ")]);
  if (card.regulation) rows.push(["Regulation", card.regulation]);
  rows.push(["Artist", card.artist || "—"]);
  if (card.releaseDate) rows.push(["Released", card.releaseDate]);
  return rows;
}

export function CardPage({ card, printing }: { card: PublicCard; printing: string | null }) {
  const [quote, setQuote] = useState<PriceQuote | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [lanes, setLanes] = useState<{ auctions: ListingLane; buyNow: ListingLane } | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [pin, setPin] = useState<Pin>(NO_PIN);

  useEffect(() => {
    let live = true;
    const post = (url: string) =>
      fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [card.id] }) });

    (async () => {
      try {
        const response = await post("/api/prices");
        const payload = (await response.json()) as { quotes?: Record<string, PriceQuote | null> };
        if (live) setQuote(response.ok ? payload.quotes?.[card.id] ?? null : null);
      } catch {
        if (live) setQuote(null);
      } finally {
        if (live) setLoading(false);
      }
      try {
        const response = await fetch(`/api/history?id=${encodeURIComponent(card.id)}`);
        const payload = (await response.json()) as { snapshots?: Snapshot[] };
        if (live && response.ok) setSnapshots(payload.snapshots ?? []);
      } catch {
        /* history is optional */
      }
    })();

    post("/api/market")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { results?: { id: string; auctions: ListingLane; buyNow: ListingLane }[] } | null) => {
        const hit = payload?.results?.find((entry) => entry.id === card.id);
        if (live && hit) setLanes({ auctions: hit.auctions, buyNow: hit.buyNow });
      })
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, [card.id]);

  const variants = [...(quote?.variants ?? [])].sort((a, b) => finishRank(a.key) - finishRank(b.key));
  const fromLink = findPrinting(variants, printing);
  const active = resolveActive({ finish: null, modifiers: [], variants, pickedKey: fromLink?.key ?? null, loaded: Boolean(quote) });
  const activeKey = active.key;
  const selected = variants.find((entry) => entry.key === activeKey) ?? null;
  const finish = finishOf(activeKey) ?? finishOf(printing);
  const waiting = !printing && quote === undefined;
  const hold = active.needsPick || waiting;
  const dim = hold ? "pointer-events-none opacity-30 transition-opacity select-none" : "transition-opacity";
  const auctions = lanes?.auctions ?? emptyLane(card, "auction");
  const buyNow = lanes?.buyNow ?? emptyLane(card, "bin");

  const marketPoints: ChartPoint[] = activeKey
    ? snapshots.flatMap((snap) => {
        const value = snap.v[activeKey]?.market;
        return value != null ? [{ label: snap.d, value }] : [];
      })
    : [];
  const cardmarketHistory: ChartPoint[] = snapshots.flatMap((snap) => (snap.cm?.avg7 != null ? [{ label: snap.d, value: snap.cm.avg7 }] : []));
  const averages = saleAverages(quote, selected);
  const averagePoints: ChartPoint[] = averages
    ? [
        ...(averages.avg30 != null ? [{ label: "30-day average", value: averages.avg30 }] : []),
        ...(averages.avg7 != null ? [{ label: "7-day average", value: averages.avg7 }] : []),
        ...(averages.avg1 != null ? [{ label: "Yesterday", value: averages.avg1 }] : []),
      ]
    : [];
  const since = snapshots[0]?.d;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <HoldingsProvider>
      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6">
        <Link href="/" className="text-sm text-[#b3a694] hover:text-[#f3ecdf]">
          ← Back to the desk
        </Link>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
          <aside inert={hold} className={`flex flex-col gap-4 ${dim}`}>
            {filters.condition === "raw" ? (
              <CardPicture src={selected?.image || card.large || card.small} alt={card.name} finish={finish} stamp={card.setCode || card.setName} width={480} height={670} priority className="rounded-xl bg-[#2a241e]" />
            ) : (
              <Slab company={filters.condition} grade={filters.grade}>
                <CardPicture src={selected?.image || card.large || card.small} alt={card.name} finish={finish} stamp={card.setCode || card.setName} width={480} height={670} priority className="rounded-xl bg-[#2a241e]" />
              </Slab>
            )}
            {finish === "reverse" ? <p className="text-center text-[10px] leading-tight text-[#b3a694]">Placed stamp. Not a photo of the stamped card.</p> : null}
            <AddToCollection
              card={card}
              printing={activeKey ? printingSlug(activeKey) : null}
              initialCondition={filters.condition}
              initialGrade={filters.grade}
              size="default"
              variant="default"
              key={`${filters.condition}-${filters.grade}-${activeKey}`}
            />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-2xl border border-white/10 bg-[#1c1814]/80 p-4 text-sm">
              {facts(card).map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-[#b3a694]">{label}</dt>
                  <dd className="text-right text-[#f3ecdf]">{value}</dd>
                </div>
              ))}
            </dl>
          </aside>

          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-serif text-4xl leading-none tracking-tight sm:text-5xl">{card.name}</h1>
                <p className="mt-2 text-sm text-[#b3a694]">
                  {card.setName} · {card.printedTotal ? `${card.number}/${card.printedTotal}` : card.number}
                  {selected ? ` · ${variantLabel(selected.key)}` : ""}
                </p>
              </div>
              <HoldingToggles cardId={card.id} printing={activeKey ? printingSlug(activeKey) : null} condition={filters.condition} grade={filters.grade} labeled />
            </div>

            {waiting ? (
              <div className="rounded-2xl border-2 border-[#f0d7a4] bg-[#2a2216] p-4" aria-busy="true">
                <p className="font-serif text-xl italic text-[#f3ecdf]">Which printing do you mean?</p>
                <p className="mt-1 text-xs leading-relaxed text-[#d8c9ab]">Checking which printings this card comes in. The price depends on it.</p>
              </div>
            ) : null}
            {variants.length > 1 ? (
              <PrintingPicker variants={variants} activeKey={activeKey} needsPick={active.needsPick} missing={null} hrefFor={(key) => cardHref(card.id, printingSlug(key))} />
            ) : null}

            <div className={`${hold ? "hidden" : "flex"} flex-col gap-5`}>
            <MarketFilters filters={filters} onChange={setFilters} conditionLabel="Condition" />

            {filters.condition === "raw" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <PriceChart
                  title="TCGplayer market price"
                  currency="USD"
                  points={marketPoints}
                  empty={loading ? "Loading…" : "No price saved for this printing yet."}
                  note={since ? `Saved once a day while Charsi runs, since ${quoteDate(since) ?? since}. It grows as you keep using it.` : "History starts the first time this card’s price is saved. No free source publishes older sales."}
                />
                <PriceChart
                  title="Cardmarket 7-day average"
                  currency="EUR"
                  points={cardmarketHistory.length > 1 ? cardmarketHistory : averagePoints}
                  empty={loading ? "Loading…" : "Cardmarket has no sales average for this card."}
                  note={cardmarketHistory.length > 1 ? "Saved daily by Charsi." : "Until daily history builds up, this shows the 30-day, 7-day and yesterday averages Cardmarket reports."}
                />
              </div>
            ) : (
              <section className="rounded-2xl border border-dashed border-white/15 p-4 text-sm leading-relaxed text-[#b3a694]">
                <h3 className="mb-1 text-[10px] font-medium tracking-[0.16em] text-[#d4a574] uppercase">
                  {filters.condition} {filters.grade} history
                </h3>
                No free source publishes graded sale history, so there is no chart to draw and nothing here is guessed. The rows below open eBay for exactly this grade, and graded prices and history show up if a Scrydex key is connected.
              </section>
            )}

            <section className="rounded-2xl border border-white/10 bg-[#1c1814]/80 p-4">
              <CardMarket
                card={card}
                modifiers={[]}
                quote={quote}
                loading={loading}
                auctions={auctions}
                buyNow={buyNow}
                pin={pin}
                onPin={setPin}
                filters={filters}
                variantKey={activeKey}
                hideDetailsLink
              />
            </section>
            {card.attacks.length > 0 ? (
              <section className="rounded-2xl border border-white/10 bg-[#1c1814]/80 p-4">
                <h3 className="mb-2 text-[10px] font-medium tracking-[0.16em] text-[#d4a574] uppercase">Attacks</h3>
                <ul className="flex flex-wrap gap-2 text-sm text-[#f3ecdf]">
                  {card.attacks.map((attack) => (
                    <li key={attack} className="rounded-full bg-white/[0.06] px-3 py-1">
                      {attack}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            </div>
          </div>
        </div>
      </main>
      </HoldingsProvider>
    </div>
  );
}
