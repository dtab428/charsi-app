"use client";

import Image from "next/image";
import { useState } from "react";
import type { Finish } from "@/lib/format";

function Stamp({ label }: { label: string }) {
  const text = (label || "R").slice(0, 4).toUpperCase();
  return (
    <span className="pointer-events-none absolute" style={{ left: "68%", top: "33%", width: "18%" }} title="Placed set stamp. Not a photo of the stamped card.">
      <svg viewBox="0 0 64 64" className="h-auto w-full drop-shadow-[0_1px_1px_rgba(0,0,0,0.65)]" aria-hidden>
        <circle cx="32" cy="32" r="30" fill="#c6a15b" />
        <circle cx="32" cy="32" r="24" fill="none" stroke="#5c4316" strokeWidth="1.5" />
        <circle cx="32" cy="32" r="27" fill="none" stroke="#f3e2b0" strokeWidth="1" />
        <text x="32" y="36" textAnchor="middle" fontSize={text.length > 3 ? "9" : "11"} fontFamily="sans-serif" fontWeight="700" fill="#3a2a0c">
          {text}
        </text>
      </svg>
    </span>
  );
}

function Mark({ finish, stamp }: { finish: Finish | null; stamp: string }) {
  if (finish === "reverse") return <Stamp label={stamp} />;
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
  width,
  height,
  priority,
  className,
}: {
  src: string;
  alt: string;
  finish: Finish | null;
  stamp?: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}) {
  const [fallback, setFallback] = useState<{ for: string; src: string } | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const current = fallback?.for === src ? fallback.src : src;
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
          if (!current.startsWith("/api/image") && src.startsWith("https://")) {
            setFallback({ for: src, src: `/api/image?src=${encodeURIComponent(src)}` });
          }
        }}
      />
      <Mark finish={finish} stamp={stamp} />
    </span>
  );
}
