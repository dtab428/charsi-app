import type { ReactNode } from "react";

const LOOK: Record<string, { plastic: string; label: string; ink: string }> = {
  PSA: { plastic: "#ece7df", label: "#c8102e", ink: "#fff8f6" },
  BGS: { plastic: "#161616", label: "#0e0e0e", ink: "#f0d48a" },
  CGC: { plastic: "#d5dbe3", label: "#1a4e8a", ink: "#f4f8ff" },
  TAG: { plastic: "#f3f0ea", label: "#111111", ink: "#f7f4ee" },
  SGC: { plastic: "#101010", label: "#111111", ink: "#f0d48a" },
};

export function Slab({ company, grade, children }: { company: string; grade: string; children: ReactNode }) {
  const look = LOOK[company] ?? LOOK.PSA;
  return (
    <div className="rounded-[12px] p-1.5 pb-2.5" style={{ background: look.plastic }} aria-label={`${company} ${grade} slab`}>
      <div className="mb-1 rounded-[5px] px-2 py-1 text-center" style={{ background: look.label, color: look.ink }}>
        <p className="text-[9px] font-semibold tracking-[0.22em]">{company}</p>
        <p className="font-serif text-[1.65rem] leading-none">{grade}</p>
      </div>
      <div className="overflow-hidden rounded-[4px] bg-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.45)]">{children}</div>
    </div>
  );
}
