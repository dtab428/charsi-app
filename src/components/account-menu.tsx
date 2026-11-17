"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/ripple";

export type Me = {
  configured: boolean;
  user: { id: string; name: string; avatar: string | null; provider: "discord" | "local" } | null;
};

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/me")
      .then((response) => (response.ok ? (response.json() as Promise<Me>) : null))
      .then((value) => {
        if (live) setMe(value);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return { me, setMe };
}

export function useSigninNotice() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get("signin");
    if (!result) return;
    url.searchParams.delete("signin");
    window.history.replaceState(null, "", url.pathname + url.search);
    if (result === "ok") toast.success("Signed in with Discord.");
    else if (result === "unconfigured") toast.error("Discord sign-in isn’t set up yet. The README has the three steps.");
    else toast.error("Discord sign-in didn’t finish. Try once more.");
  }, []);
}

export function AccountMenu() {
  const { me, setMe } = useMe();
  useSigninNotice();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(me ? { ...me, user: null } : me);
    toast("Signed out.");
    window.location.reload();
  }

  if (!me) return <div className="h-8 w-40 animate-pulse rounded-full bg-white/10" aria-hidden />;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pressable href="/collection" sameTab className="inline-flex h-8 items-center rounded-full border border-white/15 px-3 text-sm hover:bg-white/10">
        My Collection
      </Pressable>
      {me.user ? (
        <div className="flex items-center gap-2">
          {me.user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.user.avatar} alt="" width={28} height={28} className="size-7 rounded-full" />
          ) : null}
          <span className="max-w-32 truncate text-sm text-[#f3ecdf]" title={me.user.provider === "local" ? "Local profile for trying things out. Add Discord keys to sign in for real." : undefined}>
            {me.user.name}
          </span>
          {me.user.provider === "discord" ? (
            <Button type="button" size="sm" variant="ghost" onClick={signOut}>
              Sign out
            </Button>
          ) : null}
        </div>
      ) : me.configured ? (
        <Pressable href="/api/auth/discord" sameTab className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
          Sign in with Discord
        </Pressable>
      ) : (
        <span className="text-xs text-[#b3a694]">Discord sign-in isn’t set up</span>
      )}
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#14110e]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-serif text-3xl leading-none italic tracking-tight">
          Charsi
        </Link>
        <AccountMenu />
      </div>
    </header>
  );
}
