"use client";

import Image from "next/image";
import { useId, useState } from "react";
import type { Finish } from "@/lib/format";
import { stampPaths } from "@/lib/stamp-art";

function Stamp({ id }: { id: string }) {
  const paths = stampPaths(id);
  const grad = useId();
  if (!paths) return null;
  return (
    <span className="pointer-events-none absolute" style={{ left: "63%", top: "30%", width: "16%" }} title="Set symbol placed on the holo photo. Not a scan of the stamped card.">
      <svg viewBox="0 0 64 64" className="h-auto w-full drop-shadow-[0_1px_1px_rgba(0,0,0,0.75)]" aria-hidden>
        <defs>
          <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff6d2" />
            <stop offset="45%" stopColor="#e0b44a" />
            <stop offset="100%" stopColor="#8d5d16" />
          </linearGradient>
        </defs>
        {paths.map((d) => (
          <path key={d} d={d} fill={`url(#${grad})`} fillRule="evenodd" />
        ))}
      </svg>
    </span>
  );
}

function Mark({ finish, stamp, badge }: { finish: Finish | null; stamp: string; badge: boolean }) {
  if (finish === "reverse" && stamp) {
    return (
      <>
        <Stamp id={stamp} />
        {badge ? <span className="pointer-events-none absolute top-1.5 left-1.5 rounded-full bg-[#c6a15b] px-2 py-0.5 text-[10px] font-medium tracking-[0.12em] text-[#241c14] uppercase">Reverse</span> : null}
      </>
    );
  }
  if (!badge) return null;
  if (finish === "reverse") {
    return <span className="pointer-events-none absolute top-1.5 left-1.5 rounded-full bg-[#c6a15b] px-2 py-0.5 text-[10px] font-medium tracking-[0.12em] text-[#241c14] uppercase">Reverse</span>;
  }
  if (finish === "holo") {
    return (
      <>
        <span className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-[#f0d7a4]" />
        <span className="pointer-events-none absolute top-1.5 left-1.5 rounded-full bg-[#f0d7a4] px-2 py-0.5 text-[10px] font-medium tracking-[0.12em] text-[#241c14] uppercase">Holo</span>
      </>
    );
  }
  if (finish === "normal") {
    return <span className="pointer-events-none absolute top-1.5 left-1.5 rounded-full bg-[#14110e]/80 px-2 py-0.5 text-[10px] tracking-[0.12em] text-[#f3ecdf] uppercase">Non-holo</span>;
  }
  return null;
}

export function CardPicture({
  src,
  alt,
  finish,
  stamp = "",
  badge = false,
  width,
  height,
  priority,
  className,
  backup,
}: {
  src: string;
  alt: string;
  finish: Finish | null;
  stamp?: string;
  badge?: boolean;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
  backup?: string;
}) {
  const [attempt, setAttempt] = useState<{ for: string; step: number }>({ for: src, step: 0 });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const chain = [src, `/api/image?src=${encodeURIComponent(src)}`, ...(backup ? [backup, `/api/image?src=${encodeURIComponent(backup)}`] : [])].filter((entry) => entry.startsWith("https://") || entry.startsWith("/api/image") || entry === src);
  const step = attempt.for === src ? attempt.step : 0;
  const current = chain[Math.min(step, chain.length - 1)] ?? src;
  const loaded = loadedFor === current;

  return (
    <span className="relative block">
      {loaded ? null : <span className="absolute inset-0 animate-pulse rounded-md bg-white/10" aria-hidden />}
      <Image
        src={current}
        alt={alt}
        width={width}
        height={height}
        unoptimized
        priority={priority}
        className={className ?? "rounded-md bg-[#2a241e]"}
        style={{ width: "100%", height: "auto" }}
        onLoad={() => setLoadedFor(current)}
        onError={() => {
          if (step + 1 < chain.length) setAttempt({ for: src, step: step + 1 });
        }}
      />
      <Mark finish={finish} stamp={stamp} badge={badge} />
    </span>
  );
}
