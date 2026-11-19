"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Company } from "@/lib/feed";
import { asWear, isWear, type Wear } from "@/lib/wear";
import { Check, Heart, Plus } from "lucide-react";

type Saved = {
  id: string;
  cardId: string;
  kind: "raw" | "graded";
  company: string | null;
  grade: string | null;
  printing: string | null;
  wear: string | null;
};

type Spec = Saved extends infer T ? Omit<T, "id"> : never;

type Lists = { wishlist: Saved[]; collection: Saved[]; authed: boolean; ready: boolean };

const EMPTY: Lists = { wishlist: [], collection: [], authed: false, ready: false };
const HoldingsContext = createContext<{ lists: Lists; toggle: (bucket: "wishlist" | "collection", spec: Spec) => Promise<void> } | null>(null);

function savedFrom(value: unknown): Saved[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Partial<Saved>;
    if (typeof row.id !== "string" || typeof row.cardId !== "string") return [];
    if (row.kind !== "raw" && row.kind !== "graded") return [];
    return [{ id: row.id, cardId: row.cardId, kind: row.kind, company: row.company ?? null, grade: row.grade ?? null, printing: row.printing ?? null, wear: row.kind === "raw" && isWear(row.wear) ? asWear(row.wear) : null }];
  });
}

async function readList(url: string): Promise<{ authed: boolean; entries: Saved[] }> {
  const response = await fetch(url);
  if (response.status === 401) return { authed: false, entries: [] };
  if (!response.ok) return { authed: true, entries: [] };
  const payload = (await response.json()) as { entries?: unknown };
  return { authed: true, entries: savedFrom(payload.entries) };
}

export function HoldingsProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<Lists>(EMPTY);
  const pending = useRef(new Set<string>());

  useEffect(() => {
    let live = true;
    Promise.all([readList("/api/wishlist"), readList("/api/collection")])
      .then(([wishlist, collection]) => {
        if (!live) return;
        setLists({ wishlist: wishlist.entries, collection: collection.entries, authed: wishlist.authed && collection.authed, ready: true });
      })
      .catch(() => {
        if (live) setLists({ ...EMPTY, ready: true });
      });
    return () => {
      live = false;
    };
  }, []);

  async function toggle(bucket: "wishlist" | "collection", spec: Spec) {
    const lock = `${bucket}:${spec.cardId}:${spec.kind}:${spec.company ?? ""}:${spec.grade ?? ""}:${spec.printing ?? ""}:${spec.wear ?? ""}`;
    if (pending.current.has(lock)) return;
    pending.current.add(lock);
    try {
      if (!lists.authed) {
        toast.error("Sign in with Discord to save this.");
        return;
      }
      const url = bucket === "wishlist" ? "/api/wishlist" : "/api/collection";
      const name = bucket === "wishlist" ? "wishlist" : "collection";
      const match = lists[bucket].find((entry) => same(entry, spec));
      const response = match
        ? await fetch(`${url}?id=${encodeURIComponent(match.id)}`, { method: "DELETE" })
        : await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...spec, quantity: 1 }) });
      if (response.status === 401) {
        toast.error("Sign in with Discord to save this.");
        return;
      }
      if (!response.ok) {
        toast.error(`That didn’t update your ${name}.`);
        return;
      }
      const payload = (await response.json()) as { entries?: unknown };
      setLists((previous) => ({ ...previous, [bucket]: savedFrom(payload.entries) }));
      toast.success(match ? `Removed from your ${name}.` : `Added to your ${name}.`);
    } catch {
      toast.error("That didn’t save.");
    } finally {
      pending.current.delete(lock);
    }
  }

  return <HoldingsContext.Provider value={{ lists, toggle }}>{children}</HoldingsContext.Provider>;
}

function same(entry: Saved, spec: Spec): boolean {
  const wear = entry.kind === "raw" && (entry.wear ?? "NM") === (spec.wear ?? "NM");
  return entry.cardId === spec.cardId && entry.kind === spec.kind && (entry.company ?? null) === spec.company && (entry.grade ?? null) === spec.grade && (entry.printing ?? null) === spec.printing && (entry.kind !== "raw" || wear);
}

export function HoldingToggles({
  cardId,
  printing,
  condition,
  grade,
  wear = "NM",
  labeled = false,
}: {
  cardId: string;
  printing: string | null;
  condition: "raw" | Company;
  grade: string;
  wear?: Wear;
  labeled?: boolean;
}) {
  const holdings = useContext(HoldingsContext);
  const spec: Spec = {
    cardId,
    kind: condition === "raw" ? "raw" : "graded",
    company: condition === "raw" ? null : condition,
    grade: condition === "raw" ? null : grade,
    printing,
    wear: condition === "raw" ? wear : null,
  };
  const lists = holdings?.lists ?? EMPTY;
  const wished = lists.wishlist.some((entry) => same(entry, spec));
  const owned = lists.collection.some((entry) => same(entry, spec));

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button
        type="button"
        size={labeled ? "sm" : "icon"}
        variant="outline"
        aria-pressed={wished}
        aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        disabled={!lists.ready}
        onClick={() => void holdings?.toggle("wishlist", spec)}
        className={`rounded-full ${wished ? "border-transparent bg-[#efe6d4] text-[#241c14] hover:bg-[#efe6d4]" : "border-white/20"}`}
      >
        <Heart className={wished ? "fill-[#c23b3b] text-[#c23b3b]" : ""} />
        {labeled ? (wished ? "On wishlist" : "Wishlist") : null}
      </Button>
      <Button
        type="button"
        size={labeled ? "sm" : "icon"}
        variant="outline"
        aria-pressed={owned}
        aria-label={owned ? "Remove from collection" : "Add to collection"}
        disabled={!lists.ready}
        onClick={() => void holdings?.toggle("collection", spec)}
        className={`rounded-full ${owned ? "border-transparent bg-[#efe6d4] text-[#241c14] hover:bg-[#efe6d4]" : "border-white/20"}`}
      >
        {owned ? <Check /> : <Plus />}
        {labeled ? (owned ? "In collection" : "Collection") : null}
      </Button>
    </div>
  );
}
