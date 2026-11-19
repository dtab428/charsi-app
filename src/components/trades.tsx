"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/account-menu";
import { Pressable } from "@/components/ui/ripple";
import { Skeleton } from "@/components/ui/skeleton";
import type { TradeMatch } from "@/lib/trade-read";

type Row = {
  id: string;
  title: string;
  author: string;
  permalink: string;
  created: number;
  pictures: string[];
  matches: TradeMatch[];
  note: string;
};

function when(created: number): string {
  if (!created) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).format(new Date(created * 1000));
}

export function TradesView() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [discord, setDiscord] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/trades")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
      .then((payload: { posts?: Row[]; discord?: string }) => {
        if (!live) return;
        setRows(payload.posts ?? []);
        setDiscord(payload.discord ?? "");
      })
      .catch(() => {
        if (live) setError("Trade posts didn’t load.");
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#14110e] text-[#f3ecdf]">
      <SiteHeader />
      <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="font-serif text-4xl italic">Trades</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#b3a694]">
            Recent posts from r/pkmntcgtrades. A title that names a card is matched to the catalog. A picture that holds several cards is left as a picture, because splitting ten cards out of one photo is not reliable.
          </p>
        </div>
        {discord ? <p className="rounded-2xl border border-dashed border-white/15 px-4 py-3 text-sm leading-relaxed text-[#b3a694]">{discord}</p> : null}
        {error ? <p className="rounded-2xl border border-[#d4654f]/40 bg-[#d4654f]/10 px-4 py-3 text-sm">{error}</p> : null}
        {rows == null && !error ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-36 rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : null}
        {rows?.length === 0 ? <p className="text-sm text-[#b3a694]">No posts came back.</p> : null}
        <ul className="flex flex-col gap-4">
          {rows?.map((row) => (
            <li key={row.id} className="rounded-2xl border border-white/10 bg-[#1c1814] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <a href={row.permalink} target="_blank" rel="noreferrer" className="font-medium text-[#f3ecdf] underline decoration-white/20 underline-offset-4">
                  {row.title}
                </a>
                <span className="text-xs text-[#b3a694]">
                  {row.author} · {when(row.created)}
                </span>
              </div>
              {row.pictures.length > 0 ? (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {row.pictures.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="" className="h-28 w-auto rounded-lg bg-black/30 object-contain" />
                  ))}
                </div>
              ) : null}
              {row.matches.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-1">
                  {row.matches.map((match) => (
                    <li key={match.id}>
                      <Pressable sameTab href={`/card/${match.id}`} className="text-sm text-[#d4a574] hover:underline">
                        {match.name} · {match.setName} · {match.number}
                        {match.printedTotal ? `/${match.printedTotal}` : ""}
                      </Pressable>
                    </li>
                  ))}
                </ul>
              ) : null}
              {row.note ? <p className="mt-2 text-xs leading-relaxed text-[#b3a694]">{row.note}</p> : null}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
