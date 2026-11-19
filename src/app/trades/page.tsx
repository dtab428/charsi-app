import type { Metadata } from "next";
import { TradesView } from "@/components/trades";

export const metadata: Metadata = { title: "Trades · Charsi" };

export default function Page() {
  return <TradesView />;
}
