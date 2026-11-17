import type { Metadata } from "next";
import { CollectionView } from "@/components/collection";

export const metadata: Metadata = { title: "My Collection · Charsi" };

export default function Page() {
  return <CollectionView />;
}
