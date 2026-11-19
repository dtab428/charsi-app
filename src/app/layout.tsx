import type { Metadata } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import { CurrencyProvider } from "@/components/currency";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const serif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Charsi",
  description: "Lay down a Pokémon card list. Pull the pictures, then open the market around each card.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${serif.variable} dark h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        <CurrencyProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </CurrencyProvider>
      </body>
    </html>
  );
}
