"use client";

import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cn } from "cn";

type Ink = { id: number; x: number; y: number; size: number };

let inkId = 0;

function place(target: HTMLElement, clientX: number | null, clientY: number | null, unbounded: boolean): Ink {
  const rect = target.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * (unbounded ? 2.4 : 2.05);
  const localX = clientX == null ? rect.width / 2 : clientX - rect.left;
  const localY = clientY == null ? rect.height / 2 : clientY - rect.top;
  return {
    id: inkId++,
    x: (unbounded ? rect.width / 2 : localX) - size / 2,
    y: (unbounded ? rect.height / 2 : localY) - size / 2,
    size,
  };
}

export function useRipple(unbounded = false) {
  const [inks, setInks] = useState<Ink[]>([]);

  function spawn(target: HTMLElement, clientX: number | null, clientY: number | null) {
    if (target.matches(":disabled") || target.getAttribute("aria-disabled") === "true") return;
    const ink = place(target, clientX, clientY, unbounded);
    setInks((current) => [...current.slice(-5), ink]);
  }

  return {
    inks,
    clear: (id: number) => setInks((current) => current.filter((ink) => ink.id !== id)),
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      spawn(event.currentTarget, event.clientX, event.clientY);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
      spawn(event.currentTarget, null, null);
    },
  };
}

export function RippleLayer({ inks, onDone }: { inks: Ink[]; onDone: (id: number) => void }) {
  return inks.map((ink) => (
    <span
      key={ink.id}
      aria-hidden
      className="charsi-ripple"
      style={{ left: ink.x, top: ink.y, width: ink.size, height: ink.size }}
      onAnimationEnd={() => onDone(ink.id)}
    />
  ));
}

export function Pressable({
  href,
  className,
  children,
  onClick,
  sameTab,
}: {
  href?: string;
  sameTab?: boolean;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const ripple = useRipple();
  const classNames = cn("relative isolate overflow-hidden", className);
  const layer = <RippleLayer inks={ripple.inks} onDone={ripple.clear} />;
  if (href) {
    return (
      <a href={href} {...(sameTab ? {} : { target: "_blank", rel: "noreferrer" })} className={classNames} onPointerDown={ripple.onPointerDown} onKeyDown={ripple.onKeyDown}>
        {layer}
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classNames} onPointerDown={ripple.onPointerDown} onKeyDown={ripple.onKeyDown}>
      {layer}
      {children}
    </button>
  );
}
