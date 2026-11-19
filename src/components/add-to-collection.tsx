"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COMPANIES, GRADES, type Company } from "@/lib/feed";
import { printingName } from "@/lib/printing";
import { WEAR_LABEL, WEARS, type Wear } from "@/lib/wear";
import type { PublicCard } from "@/lib/types";

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" size="sm" variant={active ? "default" : "outline"} aria-pressed={active} onClick={onClick} className="rounded-full">
      {children}
    </Button>
  );
}

export function AddToCollection({
  card,
  printing,
  initialCondition = "raw",
  initialGrade = "10",
  initialWear = "NM",
  size = "sm",
  variant = "secondary",
}: {
  card: PublicCard;
  printing: string | null;
  initialCondition?: "all" | "raw" | Company;
  initialGrade?: string;
  initialWear?: Wear | "any";
  size?: "sm" | "default";
  variant?: "secondary" | "default";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"raw" | "graded">(initialCondition === "raw" || initialCondition === "all" ? "raw" : "graded");
  const [company, setCompany] = useState<Company>(initialCondition === "raw" || initialCondition === "all" ? "PSA" : initialCondition);
  const [grade, setGrade] = useState(initialGrade);
  const [quantity, setQuantity] = useState(1);
  const [wear, setWear] = useState<Wear>(initialWear === "any" ? "NM" : initialWear);
  const [saving, setSaving] = useState<"collection" | "wishlist" | null>(null);

  function pickCompany(next: Company) {
    setCompany(next);
    if (!GRADES[next].includes(grade)) setGrade(GRADES[next][0]);
  }

  async function save(destination: "collection" | "wishlist") {
    setSaving(destination);
    const where = destination === "collection" ? "My Collection" : "My Wishlist";
    try {
      const response = await fetch(destination === "collection" ? "/api/collection" : "/api/wishlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: card.id, kind, company: kind === "graded" ? company : null, grade: kind === "graded" ? grade : null, printing, quantity, wear: kind === "raw" ? wear : null }),
      });
      if (response.status === 401) {
        toast.error("Sign in with Discord first, then add it.");
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        toast.error(payload.error ?? "That didn’t save.");
        return;
      }
      const label = kind === "graded" ? `${company} ${grade}` : WEAR_LABEL[wear];
      toast.success(`${label} ${card.name} saved to ${where}.`, {
        action: { label: "Open", onClick: () => router.push(destination === "collection" ? "/collection" : "/wishlist") },
      });
      setOpen(false);
      setQuantity(1);
      setKind(initialCondition === "raw" || initialCondition === "all" ? "raw" : "graded");
      setCompany(initialCondition === "raw" || initialCondition === "all" ? "PSA" : initialCondition);
      setGrade(initialGrade);
      setWear(initialWear === "any" ? "NM" : initialWear);
    } catch {
      toast.error("That didn’t save.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <Button type="button" size={size} variant={variant} onClick={() => setOpen(true)}>
        Save a copy
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save this copy</DialogTitle>
            <DialogDescription>
              {card.name} · {card.setName} {card.number}
              {printing ? ` · ${printingName(printing)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Raw or graded">
              <Choice active={kind === "raw"} onClick={() => setKind("raw")}>
                Raw
              </Choice>
              <Choice active={kind === "graded"} onClick={() => setKind("graded")}>
                Graded
              </Choice>
            </div>
            {kind === "raw" ? (
              <div>
                <p className="mb-1.5 text-[10px] tracking-[0.14em] text-[#b3a694] uppercase">Wear</p>
                <div className="flex flex-wrap gap-1.5">
                  {WEARS.map((entry) => (
                    <Choice key={entry} active={wear === entry} onClick={() => setWear(entry)}>
                      {WEAR_LABEL[entry]}
                    </Choice>
                  ))}
                </div>
              </div>
            ) : null}
            {kind === "graded" ? (
              <>
                <div>
                  <p className="mb-1.5 text-[10px] tracking-[0.14em] text-[#b3a694] uppercase">Company</p>
                  <div className="flex flex-wrap gap-1.5">
                    {COMPANIES.map((entry) => (
                      <Choice key={entry} active={company === entry} onClick={() => pickCompany(entry)}>
                        {entry}
                      </Choice>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] tracking-[0.14em] text-[#b3a694] uppercase">Grade</p>
                  <div className="flex flex-wrap gap-1.5">
                    {GRADES[company].map((entry) => (
                      <Choice key={entry} active={grade === entry} onClick={() => setGrade(entry)}>
                        {entry}
                      </Choice>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
            <div className="flex items-center gap-3">
              <span className="text-[10px] tracking-[0.14em] text-[#b3a694] uppercase">Copies</span>
              <Button type="button" size="sm" variant="outline" aria-label="One fewer" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>
                −
              </Button>
              <span className="w-6 text-center tabular-nums">{quantity}</span>
              <Button type="button" size="sm" variant="outline" aria-label="One more" disabled={quantity >= 99} onClick={() => setQuantity((value) => Math.min(99, value + 1))}>
                +
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" className="flex-1" onClick={() => void save("collection")} disabled={saving != null}>
                {saving === "collection" ? "Adding…" : kind === "graded" ? `Collection · ${company} ${grade}` : `Collection · ${WEAR_LABEL[wear]}`}
              </Button>
              <Button type="button" variant="secondary" className="flex-1" onClick={() => void save("wishlist")} disabled={saving != null}>
                {saving === "wishlist" ? "Adding…" : kind === "graded" ? `Wishlist · ${company} ${grade}` : `Wishlist · ${WEAR_LABEL[wear]}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
