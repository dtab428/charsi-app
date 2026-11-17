"use client";

import { useMemo, useState, type ReactNode } from "react";
import { pickVariant } from "@/lib/facts";
import { endsLabel, money, percent, quoteDate, variantLabel } from "@/lib/format";
import { cardmarketSearchUrl, ebaySearchUrl, facebookSearchUrl, goldinSearchUrl, httpsHref, tcgplayerSearchUrl } from "@/lib/links";
import type { ListingLane, Pin, PriceQuote, PublicCard } from "@/lib/types";

function Ticket({
  kicker,
  title,
  href,
  action,
  children,
}: {
  kicker: string;
  title: string;
  href?: string;
  action?: string;
  children?: ReactNode;
}) {
  return (
    <article className="flex h-full max-h-48 min-h-36 flex-col overflow-auto rounded-2xl bg-[#f4efe4] p-3 text-[#241c14] shadow-[0_12px_30px_rgba(0,0,0,0.28)]">
      <p className="text-[10px] font-medium tracking-[0.16em] text-[#8a5a2a] uppercase">{kicker}</p>
      <h3 className="mt-1 font-serif text-[1.35rem] leading-none tracking-tight">{title}</h3>
      <div className="mt-2 flex-1 text-[13px] leading-snug">{children}</div>
      {href && action ? (
        <a href={href} target="_blank" rel="noreferrer" className="mt-2 text-xs underline decoration-[#241c14]/30 underline-offset-2">
          {action}
        </a>
      ) : null}
    </article>
  );
}

function Listings({ lane, empty }: { lane: ListingLane; empty: string }) {
  if (lane.status === "live") {
    return (
      <ul className="space-y-2">
        {lane.listings.map((listing) => (
          <li key={listing.url}>
            <a href={listing.url} target="_blank" rel="noreferrer" className="block hover:underline">
              <span className="font-medium">{money(listing.price, listing.currency)}</span>
              {listing.bids != null ? <span className="text-[#241c14]/70"> · {listing.bids} bids</span> : null}
              <span className="mt-0.5 block truncate text-[#241c14]/75">{listing.title}</span>
              <span className="block text-[11px] text-[#241c14]/60">
                {[endsLabel(listing.endsAt), listing.shipping, listing.condition].filter(Boolean).join(" · ")}
              </span>
            </a>
          </li>
        ))}
      </ul>
    );
  }
  return <p className="text-[#241c14]/75">{lane.notice ?? empty}</p>;
}

function slot(index: number) {
  const angle = -Math.PI / 2 + (index / 6) * Math.PI * 2;
  return {
    left: `${50 + Math.cos(angle) * 37}%`,
    top: `${50 + Math.sin(angle) * 39}%`,
  };
}

export function MarketTickets({
  card,
  modifiers,
  quote,
  loading,
  auctions,
  buyNow,
  pin,
  onPin,
  layout,
}: {
  card: PublicCard;
  modifiers: string[];
  quote: PriceQuote | null | undefined;
  loading: boolean;
  auctions: ListingLane;
  buyNow: ListingLane;
  pin: Pin;
  onPin: (pin: Pin) => void;
  layout: "stack" | "orbit";
}) {
  const initial = useMemo(() => pickVariant(modifiers, quote?.variants ?? []), [modifiers, quote]);
  const [chosen, setChosen] = useState<string | null>(null);
  const variant = quote?.variants.find((entry) => entry.key === chosen) ?? initial;
  const marketHref = httpsHref(quote?.productUrl, tcgplayerSearchUrl(card));
  const cardmarketHref = httpsHref(quote?.cardmarket?.url, cardmarketSearchUrl(card));
  const graded = quote?.graded ?? [];
  const movement = quote?.trends.filter((point) => [7, 30, 90].includes(point.days)) ?? [];
  const tickets = [
      <Ticket
        key="market"
        kicker={quote?.source === "scrydex" ? "Scrydex · raw" : "TCGplayer"}
        title={loading && !variant ? "Checking" : variant ? money(variant.market, variant.currency) : "No quote"}
        href={marketHref}
        action="Open TCGplayer"
      >
        {variant ? (
          <>
            <p>{variant.label}</p>
            <p className="mt-1 text-[#241c14]/70">
              Low {money(variant.low, variant.currency)} · Mid {money(variant.mid, variant.currency)} · High {money(variant.high, variant.currency)}
            </p>
            {quote?.updatedAt ? <p className="mt-1 text-[11px] text-[#241c14]/55">Quote date {quoteDate(quote.updatedAt)}</p> : null}
            {quote && quote.variants.length > 1 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {quote.variants.slice(0, 4).map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setChosen(entry.key)}
                    className={`rounded-full px-2 py-0.5 text-[11px] ${entry.key === variant.key ? "bg-[#241c14] text-[#f4efe4]" : "bg-[#241c14]/10"}`}
                  >
                    {variantLabel(entry.key)}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-[#241c14]/75">{loading ? "Pulling the latest quote." : "The price feed didn’t answer. The link still opens the live page."}</p>
        )}
      </Ticket>,

      quote?.cardmarket ? (
        <Ticket key="cardmarket" kicker="Cardmarket · EUR" title={money(quote.cardmarket.trend, "EUR")} href={cardmarketHref} action="Open Cardmarket">
          <p>7-day avg {money(quote.cardmarket.avg7, "EUR")}</p>
          <p>30-day avg {money(quote.cardmarket.avg30, "EUR")}</p>
          <p>Low {money(quote.cardmarket.low, "EUR")}</p>
          {quote.cardmarket.updatedAt ? <p className="mt-1 text-[11px] text-[#241c14]/55">Quote date {quoteDate(quote.cardmarket.updatedAt)}</p> : null}
        </Ticket>
      ) : graded.length > 0 ? (
        <Ticket key="graded" kicker="Graded" title={`${graded[0]?.company} ${graded[0]?.grade} · ${money(graded[0]?.market, graded[0]?.currency ?? "USD")}`} href={marketHref} action="Open TCGplayer">
          <ul>
            {graded.slice(0, 3).map((row) => (
              <li key={`${row.company}-${row.grade}`}>
                {row.company} {row.grade} · {money(row.market, row.currency)}
              </li>
            ))}
          </ul>
        </Ticket>
      ) : (
        <Ticket key="cardmarket" kicker="Cardmarket" title="Euro desk" href={cardmarketHref} action="Search Cardmarket">
          <p className="text-[#241c14]/75">No euro quote on this feed. The search opens Cardmarket for the same card.</p>
        </Ticket>
      ),

      <Ticket key="auctions" kicker="eBay · auctions" title={auctions.status === "live" ? money(auctions.listings[0]?.price, auctions.listings[0]?.currency ?? "USD") : "Auctions"} href={auctions.searchUrl} action="Current auctions">
        <Listings lane={auctions} empty="Opens eBay auctions, ending soonest first. A free eBay key lists the bids in this ticket." />
      </Ticket>,

      <Ticket key="bin" kicker="eBay · buy it now" title={buyNow.status === "live" ? money(buyNow.listings[0]?.price, buyNow.listings[0]?.currency ?? "USD") : "Buy it now"} href={buyNow.searchUrl} action="Buy it now">
        <Listings lane={buyNow} empty="Opens the newest Buy It Now listings. A free eBay key lists them here, newest first." />
      </Ticket>,

      <Ticket key="sales" kicker="Last sales" title={movement[0] ? percent(movement[0].percent) : quote?.cardmarket ? money(quote.cardmarket.avg7, "EUR") : "Sold"} href={ebaySearchUrl(card, "sold")} action="Ended recently">
        {movement.length > 0 ? (
          <ul>
            {movement.map((point) => (
              <li key={point.days}>
                {point.days} days {percent(point.percent)}
                {point.change != null
                  ? ` (${point.change > 0 ? "+" : point.change < 0 ? "−" : ""}${money(Math.abs(point.change), variant?.currency ?? "USD")})`
                  : ""}
              </li>
            ))}
          </ul>
        ) : quote?.cardmarket ? (
          <p>Cardmarket’s 7-day and 30-day averages are the recent-sale tape on this feed.</p>
        ) : (
          <p className="text-[#241c14]/75">Recent-sale averages show up with the quote. Sold auctions open on eBay.</p>
        )}
        <a href={goldinSearchUrl(card)} target="_blank" rel="noreferrer" className="mt-2 block text-xs underline decoration-[#241c14]/30">
          Goldin search
        </a>
      </Ticket>,

      <Ticket key="pin" kicker="Your pin" title={pin.price.trim() || "Community"} href={facebookSearchUrl(card)} action="Facebook Marketplace">
        <div className="flex gap-1">
          {(["facebook", "discord", "other"] as const).map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => onPin({ ...pin, source })}
              className={`rounded-full px-2 py-0.5 text-[11px] capitalize ${pin.source === source ? "bg-[#241c14] text-[#f4efe4]" : "bg-[#241c14]/10"}`}
            >
              {source}
            </button>
          ))}
        </div>
        <input
          value={pin.price}
          onChange={(event) => onPin({ ...pin, price: event.target.value.slice(0, 40) })}
          placeholder="Asking price"
          className="mt-2 w-full border-b border-[#241c14]/20 bg-transparent pb-0.5 outline-none placeholder:text-[#241c14]/40"
        />
        <input
          value={pin.note}
          onChange={(event) => onPin({ ...pin, note: event.target.value.slice(0, 80) })}
          placeholder="What they said"
          className="mt-1 w-full border-b border-[#241c14]/20 bg-transparent pb-0.5 outline-none placeholder:text-[#241c14]/40"
        />
        <p className="mt-2 text-[11px] leading-snug text-[#241c14]/55">Kept on this browser. Marketplace and Discord aren’t scanned.</p>
      </Ticket>,
  ];

  if (layout === "stack") {
    return <div className="grid gap-3 sm:grid-cols-2">{tickets}</div>;
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="absolute text-[#d4a574]" style={{ top: "4%", right: "4%", bottom: "4%", left: "4%", width: "92%", height: "92%" }} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <ellipse cx="50" cy="50" rx="37" ry="39" fill="none" stroke="currentColor" strokeOpacity="0.45" />
      </svg>
      {tickets.map((ticket, index) => (
        <div key={index} className="pointer-events-auto absolute w-[min(210px,28%)] -translate-x-1/2 -translate-y-1/2" style={slot(index)}>
          {ticket}
        </div>
      ))}
    </div>
  );
}
