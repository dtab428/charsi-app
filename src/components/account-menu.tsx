"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/ripple";

export type Me = {
  configured: boolean;
  user: { id: string; name: string; avatar: string | null; provider: "discord" } | null;
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
    else if (result === "unconfigured") toast.error(`Sign-in needs the site owner to finish setup. Discord redirect to add: ${window.location.origin}/api/auth/discord/callback. Vercel variables to add: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, SESSION_SECRET. Then redeploy.`, { duration: 20000 });
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

  if (!me) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Pressable href="/collection" sameTab className="inline-flex h-8 items-center rounded-full border border-white/15 px-3 text-sm hover:bg-white/10">
          My Collection
        </Pressable>
        <Pressable href="/wishlist" sameTab className="inline-flex h-8 items-center rounded-full border border-white/15 px-3 text-sm hover:bg-white/10">
          My Wishlist
        </Pressable>
        <Pressable href="/api/auth/discord" sameTab className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
          Sign in with Discord
        </Pressable>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pressable href="/collection" sameTab className="inline-flex h-8 items-center rounded-full border border-white/15 px-3 text-sm hover:bg-white/10">
        My Collection
      </Pressable>
      <Pressable href="/wishlist" sameTab className="inline-flex h-8 items-center rounded-full border border-white/15 px-3 text-sm hover:bg-white/10">
        My Wishlist
      </Pressable>
      {me.user ? (
        <div className="flex items-center gap-2">
          {me.user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.user.avatar} alt="" width={28} height={28} className="size-7 rounded-full" />
          ) : null}
          <span className="max-w-32 truncate text-sm text-[#f3ecdf]">{me.user.name}</span>
          <Button type="button" size="sm" variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        </div>
      ) : (
        <Pressable href="/api/auth/discord" sameTab className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
          Sign in with Discord
        </Pressable>
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
