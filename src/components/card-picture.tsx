"use client";

import Image from "next/image";
import { useState } from "react";
import type { Finish } from "@/lib/format";

function Mark({ finish }: { finish: Finish | null }) {
  if (finish === "reverse") {
    return (
      <>
        <span className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-[#d4a574] ring-dashed" />
        <span className="pointer-events-none absolute inset-x-1.5 bottom-1.5 rounded-md bg-[#14110e]/92 px-2 py-1.5 text-center">
          <span className="block text-[10px] font-medium tracking-[0.14em] text-[#d4a574] uppercase">Reverse holo</span>
          <span className="mt-0.5 block text-[10px] leading-tight text-[#f3ecdf]">Set stamp. This scan is the shared picture.</span>
        </span>
      </>
    );
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
  width,
  height,
  priority,
  className,
}: {
  src: string;
  alt: string;
  finish: Finish | null;
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
      <Mark finish={finish} />
    </span>
  );
}
