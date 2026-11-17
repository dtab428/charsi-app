import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CardPage } from "@/components/card-page";
import { getCatalog, toPublic } from "@/lib/catalog";
import { printingName } from "@/lib/printing";

type Params = Promise<{ id: string; printing?: string[] }>;

function lookup(id: string) {
  const catalog = getCatalog();
  const card = catalog.cards.find((entry) => entry.id === id);
  return card ? toPublic(catalog, card) : null;
}

function slugOf(printing: string[] | undefined): string | null {
  const slug = printing?.[0];
  return slug && /^[a-z0-9-]{1,40}$/.test(slug) && printing?.length === 1 ? slug : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, printing } = await params;
  const card = lookup(id);
  if (!card) return { title: "Card not found · Charsi" };
  const slug = slugOf(printing);
  return {
    title: `${card.name} ${card.number}${slug ? ` · ${printingName(slug)}` : ""} · ${card.setName} · Charsi`,
    description: `Prices, recent sales, live listings and price history for ${card.name} from ${card.setName}.`,
  };
}

export default async function Page({ params }: { params: Params }) {
  const { id, printing } = await params;
  const card = lookup(id);
  if (!card || (printing && printing.length > 1)) notFound();
  return <CardPage card={card} printing={slugOf(printing)} />;
}
