"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Board, type DeskItem } from "@/components/board";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { marketAmount } from "@/lib/facts";
import { fileSlug, money } from "@/lib/format";
import { GAMES, SAMPLE_LIST } from "@/lib/games";
import { cardBands } from "@/lib/photo-bands";
import { cardBlob, copyBlob, downloadBlob } from "@/lib/pictures";
import { renderSheet } from "@/lib/sheet";
import type { ListingLane, Pin, PriceQuote, PublicCard, ResolveItem } from "@/lib/types";
import { ChevronDownIcon } from "lucide-react";
import Image from "next/image";

const STORAGE = "charsi.desk.v1";

type Saved = {
  text?: string;
  title?: string;
  pins?: Record<string, Pin>;
};

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function Desk() {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [items, setItems] = useState<DeskItem[]>([]);
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, PriceQuote | null>>({});
  const [quoteSource, setQuoteSource] = useState<string>("");
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [lanes, setLanes] = useState<Record<string, { auctions: ListingLane; buyNow: ListingLane }>>({});
  const [ebayOn, setEbayOn] = useState<boolean | null>(null);
  const [pins, setPins] = useState<Record<string, Pin>>({});
  const [zoom, setZoom] = useState<PublicCard | null>(null);
  const [sheeting, setSheeting] = useState(false);
  const [reading, setReading] = useState(0);
  const [over, setOver] = useState(false);
  const dragDepth = useRef(0);
  const photosRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) ?? "null") as Saved | null;
      if (!saved) return;
      // Browser storage is read after hydration so the server render stays empty.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(saved.text ?? "");
      setTitle(saved.title ?? "");
      setPins(saved.pins ?? {});
      if (saved.text?.trim()) void pull(saved.text);
    } catch {
      localStorage.removeItem(STORAGE);
    }
    // The saved list is restored once, when the desk opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const payload: Saved = { text, title, pins };
    localStorage.setItem(STORAGE, JSON.stringify(payload));
  }, [text, title, pins]);

  async function loadPrices(ids: string[]) {
    if (ids.length === 0) return;
    setLoadingQuotes(true);
    try {
      const response = await fetch("/api/prices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const payload = await readJson<{ source?: string; quotes?: Record<string, PriceQuote | null>; error?: string }>(response);
      if (!response.ok) {
        setQuoteSource(response.status === 401 ? "Quotes stay with the signed-in desk." : "Quotes didn’t refresh. The market links still open.");
        return;
      }
      setQuotes((current) => ({ ...current, ...(payload.quotes ?? {}) }));
      setQuoteSource(
        payload.source === "scrydex"
          ? "Raw and graded quotes from Scrydex."
          : payload.source === "pokemon-tcg"
            ? "TCGplayer and Cardmarket quotes, with the date they were last refreshed."
            : "No quote came back. The market links still open.",
      );
    } catch {
      setQuoteSource("Quotes didn’t refresh. The market links still open.");
    } finally {
      setLoadingQuotes(false);
    }
  }

  async function loadMarket(ids: string[]) {
    if (ids.length === 0) return;
    try {
      const response = await fetch("/api/market", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: ids.slice(0, 24) }),
      });
      if (!response.ok) {
        setEbayOn(false);
        return;
      }
      const payload = await readJson<{ configured: boolean; results: { id: string; auctions: ListingLane; buyNow: ListingLane }[] }>(response);
      setEbayOn(payload.configured);
      setLanes((current) => {
        const next = { ...current };
        for (const result of payload.results ?? []) next[result.id] = { auctions: result.auctions, buyNow: result.buyNow };
        return next;
      });
    } catch {
      setEbayOn(false);
    }
  }

  async function addPhotos(list: File[]) {
    const images = list.filter((file) => /^image\/(jpeg|png|webp|gif)$/.test(file.type)).slice(0, 12);
    if (images.length === 0) {
      toast.error("Drop a JPEG, PNG, or WebP of the card front.");
      return;
    }
    if (list.length > images.length) toast("A few of those files weren’t pictures, so they were skipped.");
    setReading((count) => count + images.length);
    let cursor = 0;
    const next = async () => {
      const file = images[cursor];
      cursor += 1;
      if (!file) return;
      try {
        const bands = await cardBands(file);
        const body = new FormData();
        body.set("name", bands.name, "name.jpg");
        body.set("number", bands.number, "number.jpg");
        const response = await fetch("/api/identify", { method: "POST", body });
        const payload = await readJson<{ line?: string; item?: ResolveItem; error?: string }>(response);
        if (!response.ok || !payload.item) {
          toast.error(payload.error ?? "That photo didn’t read.");
        } else {
          const item = payload.item;
          setItems((current) => {
            if (current.length >= 80) return current;
            return [...current, { ...item, key: crypto.randomUUID(), included: Boolean(item.card) }];
          });
          if (payload.line) {
            setText((current) => (current.trim() ? `${current.trim()}\n${payload.line}` : payload.line ?? ""));
          }
          if (item.card) {
            void loadPrices([item.card.id]);
            void loadMarket([item.card.id]);
          }
        }
      } catch {
        toast.error("That photo didn’t read.");
      } finally {
        setReading((count) => Math.max(0, count - 1));
        await next();
      }
    };
    await Promise.all([next(), next()]);
  }

  async function pull(list = text) {
    if (!list.trim() || pulling) return;
    setPulling(true);
    setError(null);
    try {
      const response = await fetch("/api/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: list, game: "pokemon" }),
      });
      const payload = await readJson<{ items?: ResolveItem[]; error?: string }>(response);
      if (!response.ok || !payload.items) {
        setError(payload.error ?? "The catalog didn’t answer.");
        return;
      }
      const next = payload.items.map((item) => ({ ...item, key: crypto.randomUUID(), included: Boolean(item.card) }));
      setOpenKey(null);
      setItems(next);
      const ids = [...new Set(next.flatMap((item) => (item.card ? [item.card.id] : [])))];
      void loadPrices(ids);
      void loadMarket(ids);
    } catch {
      setError("The catalog didn’t answer.");
    } finally {
      setPulling(false);
    }
  }

  function choose(key: string, card: PublicCard) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, card, status: "matched", confidence: 1, included: true, alternatives: item.alternatives.filter((alt) => alt.id !== card.id) } : item)),
    );
    void loadPrices([card.id]);
    void loadMarket([card.id]);
  }

  async function copyCard(card: PublicCard) {
    try {
      const blob = await cardBlob(card.large || card.small);
      await copyBlob(blob);
      toast.success("Picture copied");
    } catch {
      try {
        const blob = await cardBlob(card.large || card.small);
        downloadBlob(blob, fileSlug(card.name, card.setCode, card.number));
        toast("Couldn’t copy, so it downloaded instead");
      } catch {
        toast.error("The picture didn’t come through");
      }
    }
  }

  async function saveCard(card: PublicCard) {
    try {
      const blob = await cardBlob(card.large || card.small);
      downloadBlob(blob, fileSlug(card.name, card.setCode, card.number));
    } catch {
      toast.error("The picture didn’t come through");
    }
  }

  async function makeSheet(copy: boolean) {
    const cells = items
      .filter((item) => item.included && item.card)
      .flatMap((item) => {
        const card = item.card as PublicCard;
        const copies = Math.min(item.quantity, 8);
        return Array.from({ length: copies }, () => ({
          src: card.large || card.small,
          name: card.name,
          line: `${card.setCode || card.setName} · ${card.printedTotal ? `${card.number}/${card.printedTotal}` : card.number}`,
        }));
      })
      .slice(0, 36);
    if (cells.length === 0) {
      toast("Nothing is on the sheet yet");
      return;
    }
    setSheeting(true);
    try {
      const blob = await renderSheet(cells, title);
      if (copy) {
        try {
          await copyBlob(blob);
          toast.success("Sheet copied");
        } catch {
          downloadBlob(blob, "charsi-sheet.png");
          toast("Couldn’t copy the sheet, so it downloaded");
        }
      } else {
        downloadBlob(blob, "charsi-sheet.png");
      }
    } catch {
      toast.error("The sheet didn’t render");
    } finally {
      setSheeting(false);
    }
  }

  const matched = items.filter((item) => item.card).length;
  const picks = items.filter((item) => item.status === "ambiguous").length;
  const onSheet = items.filter((item) => item.included && item.card).length;
  const worth = items.reduce((sum, item) => {
    if (!item.card) return sum;
    const amount = marketAmount(item.modifiers, quotes[item.card.id]);
    return amount == null ? sum : sum + amount * item.quantity;
  }, 0);
  const priced = items.filter((item) => item.card && marketAmount(item.modifiers, quotes[item.card.id]) != null).length;
  const listWorth = priced > 0 ? money(worth, "USD") : "";
  const skeletons = Math.min(8, Math.max(3, text.split(/\n|,/).filter((line) => line.trim()).length));

  return (
    <div
      className="min-h-full bg-[#14110e] text-[#f3ecdf]"
      onDragEnter={(event) => {
        if (![...event.dataTransfer.types].includes("Files")) return;
        event.preventDefault();
        dragDepth.current += 1;
        setOver(true);
      }}
      onDragOver={(event) => {
        if ([...event.dataTransfer.types].includes("Files")) event.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setOver(false);
      }}
      onDrop={(event) => {
        if (![...event.dataTransfer.types].includes("Files")) return;
        event.preventDefault();
        dragDepth.current = 0;
        setOver(false);
        void addPhotos([...event.dataTransfer.files]);
      }}
    >
      {over ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-[#14110e]/80">
          <p className="rounded-full bg-[#efe6d4] px-6 py-3 font-serif text-3xl text-[#241c14] italic">Drop the cards</p>
        </div>
      ) : null}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#14110e]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="font-serif text-3xl leading-none italic tracking-tight">Charsi</h1>
            <p className="mt-1 text-xs text-[#b3a694]">Lay a list down. Every card on it keeps its own numbers.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1 rounded-full border border-white/15 px-3 text-sm">
                Pokémon
                <ChevronDownIcon className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                {GAMES.map((game) => (
                  <DropdownMenuItem key={game.id} disabled={game.state !== "live"}>
                    {game.name}
                    {game.state === "next" ? <span className="ml-auto text-xs text-[#b3a694]">Next</span> : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-6">
        <section className="rounded-[28px] bg-[#efe6d4] p-5 text-[#241c14] shadow-[0_24px_60px_rgba(0,0,0,0.35)] sm:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-serif text-3xl italic">The list</h2>
            <button
              type="button"
              className="text-sm underline decoration-[#241c14]/30 underline-offset-4"
              onClick={() => {
                setText(SAMPLE_LIST);
                void pull(SAMPLE_LIST);
              }}
            >
              Use a messy sample
            </button>
          </div>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void pull();
              }
            }}
            aria-label="Card list"
            placeholder="Dragonite TRR stamp, Rayquaza ex 039, charzard base set 4"
            className="mt-4 min-h-52 resize-y border-0 bg-transparent p-0 text-base leading-relaxed text-[#241c14] shadow-none placeholder:text-[#241c14]/35 focus-visible:ring-0 md:text-base"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={pulling || !text.trim()}
              onClick={() => void pull()}
              className="h-10 rounded-full bg-[#241c14] px-5 text-[#efe6d4] hover:bg-[#241c14]/90"
            >
              {pulling ? "Pulling…" : "Pull the cards"}
            </Button>
            <Button type="button" variant="outline" disabled={reading > 0} onClick={() => photosRef.current?.click()}>
              {reading > 0 ? `Reading ${reading}…` : "Add photos"}
            </Button>
            <input
              ref={photosRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="sr-only"
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                event.target.value = "";
                if (files.length > 0) void addPhotos(files);
              }}
            />
            <p className="max-w-xl text-sm text-[#241c14]/70">
              Commas, new lines, or photos of the fronts. Drop one card or a handful. Partial names and typos are fine.
            </p>
          </div>
        </section>

        {error ? <p className="rounded-2xl border border-[#d4654f]/40 bg-[#d4654f]/10 px-4 py-3 text-sm">{error}</p> : null}

        {pulling && items.length === 0 ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: skeletons }, (_, index) => (
              <Skeleton key={index} className="h-28 rounded-[24px] bg-white/10" />
            ))}
          </div>
        ) : null}

        {items.length > 0 ? (
          <section className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-serif text-2xl italic">
                  {matched} on the desk{picks ? ` · ${picks} ${picks === 1 ? "needs" : "need"} a pick` : ""}
                  {listWorth ? ` · about ${listWorth} on TCGplayer` : ""}
                </p>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#b3a694]">
                  {quoteSource || "Pictures are ready. Quotes follow."}
                  {ebayOn === false ? " eBay auctions and Buy It Now open as live searches until a key is connected." : ""}
                  {ebayOn === true ? " eBay auctions and Buy It Now are live." : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value.slice(0, 60))}
                  placeholder="Sheet title"
                  aria-label="Sheet title"
                  className="h-8 w-40"
                />
                <Button type="button" size="sm" variant="secondary" disabled={sheeting || onSheet === 0} onClick={() => void makeSheet(false)}>
                  {sheeting ? "Drawing…" : `Download sheet (${onSheet})`}
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={sheeting || onSheet === 0} onClick={() => void makeSheet(true)}>
                  Copy sheet
                </Button>
              </div>
            </div>
            <Board
              items={items}
              openKey={openKey}
              quotes={quotes}
              loadingQuotes={loadingQuotes}
              lanes={lanes}
              pins={pins}
              onOpen={setOpenKey}
              onPin={(id, pin) => setPins((current) => ({ ...current, [id]: pin }))}
              onInclude={(key, included) => setItems((current) => current.map((item) => (item.key === key ? { ...item, included } : item)))}
              onRemove={(key) => setItems((current) => current.filter((item) => item.key !== key))}
              onChoose={choose}
              onCopy={(card) => void copyCard(card)}
              onSave={(card) => void saveCard(card)}
              onZoom={setZoom}
            />
          </section>
        ) : null}
      </main>

      <footer className="mx-auto max-w-[1200px] px-4 pt-4 pb-10 text-xs leading-relaxed text-[#b3a694]">
        Card data and images are © Pokémon, Nintendo, Creatures, and GAME FREAK. Charsi isn’t affiliated with them, or with eBay, TCGplayer, Cardmarket, Goldin, Facebook, or Discord. Prices come from the Pokémon TCG API (TCGplayer and Cardmarket) unless a Scrydex key is connected. eBay listings load with an eBay application key. Goldin, Facebook Marketplace, and Discord are links and pins, not a scrape.
      </footer>

      <Dialog open={zoom != null} onOpenChange={(open) => !open && setZoom(null)}>
        <DialogContent className="bg-[#1c1814] sm:max-w-3xl">
          {zoom ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl italic">{zoom.name}</DialogTitle>
                <DialogDescription>
                  {zoom.setName} · {zoom.number}
                  {zoom.printedTotal ? `/${zoom.printedTotal}` : ""} · {zoom.rarity}
                </DialogDescription>
              </DialogHeader>
              <Image src={zoom.large || zoom.small} alt={zoom.name} width={480} height={670} unoptimized className="mx-auto max-h-[70vh]" style={{ width: "auto", height: "auto" }} />
              <div className="flex gap-2">
                <Button type="button" onClick={() => void copyCard(zoom)}>Copy this picture</Button>
                <Button type="button" variant="secondary" onClick={() => void saveCard(zoom)}>Save this picture</Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
