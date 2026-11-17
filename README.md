# Charsi

A desk for card lists. Paste a messy want-list, and Charsi finds the cards — typos, short set codes, and missing words included — then lays out the pictures. Each card keeps the market around it: TCGplayer, Cardmarket, eBay auctions, Buy It Now, recent sales, and a pin for a price you saw on Facebook or Discord.

Pokémon is the live catalog. Magic, Yu-Gi-Oh!, Lorcana, One Piece, and Gundam are named in the switcher so the desk can take the next game without changing shape. Quotes for those games come through Scrydex once that catalog is connected.

## Use it

Write one card per line, or separate them with commas.

```
Dragonite TRR stamp
Rayquaza ex 039
charzard base set 4
2x Umbreon VMAX 215
```

- `4x` or `x4` means four copies. A bare number is the collector number.
- Set codes (`TRR`, `OBF`, `151`) and set names both work.
- “Use a messy sample” loads a list that includes a typo and one card that needs a pick.

**Pull the cards** fetches the pictures. You can also drop photos of the card fronts, or use Add photos. Each picture is read and added to the same list. The page is that same card, repeated for the whole list. Every card shows its picture and the numbers on it: TCGplayer, Cardmarket, eBay auctions, Buy It Now, recent sales, and your pin. Open any card when you want the full ring of tickets. Copy or save any single picture. Download or copy the sheet when you want every selected picture in one image. Cards marked “Off the sheet” stay on the desk and off the sheet.

The ring on an open card shows:

- TCGplayer market, low, mid, and high, by printing
- Cardmarket trend and 7- and 30-day averages, in euros
- Current eBay auctions
- eBay Buy It Now
- Recent sales, plus a Goldin search
- A pin you keep in this browser for a Facebook, Discord, or other ask

Quote dates are shown on the ticket. eBay bids and Buy It Now prices appear in the ticket when an eBay key is connected. Until then, those tickets open the live eBay search. Goldin, Facebook Marketplace, and Discord are not scraped.

## Run it

```bash
npm install
npm run dev
```

The dev server listens on port 4177.

```bash
npm test
npm run lint
```

## Keys

Copy `.env.example` to `.env.local` if you want live feeds beyond the public fallback.

| Variable | What it unlocks |
| --- | --- |
| `SCRYDEX_API_KEY` and `SCRYDEX_TEAM_ID` | Preferred quotes: raw prices, trends, and graded prices. Also the route for other trading card games. [Scrydex](https://scrydex.com) |
| `POKEMON_TCG_API_KEY` | Higher rate limit on the public Pokémon TCG API, used when Scrydex is not set |
| `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` | Live eBay auctions and Buy It Now inside the tickets |

Without those keys, pictures, matching, TCGplayer, and Cardmarket still work. TCGplayer and Cardmarket numbers come from the public Pokémon TCG API and can lag the live market. The date on the ticket is the quote date, not a bid.

## Refresh the catalog

The matcher reads `data/catalog/pokemon.json`, a compact snapshot of the English Pokémon card catalog.

```bash
git clone --depth 1 https://github.com/PokemonTCG/pokemon-tcg-data.git /tmp/pokemon-tcg-data
POKEMON_TCG_DATA=/tmp/pokemon-tcg-data npm run catalog
```

## Another game

Add a catalog file under `data/catalog/`, teach `src/lib/catalog.ts` to load it, and point the Scrydex client in `src/lib/prices.ts` at that game’s path (`/magic/v1`, `/lorcana/v1`, and the others Scrydex already serves). The desk, the sheet, and the tickets stay the same.
