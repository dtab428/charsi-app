import type { Metadata } from "next";
import { WishlistView } from "@/components/collection";

export const metadata: Metadata = { title: "My Wishlist · Charsi" };

export default function Page() {
  return <WishlistView />;
}
