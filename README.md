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

**Pull the cards** fetches the pictures. You can also drop photos of the card fronts, or use Add photos. Each card shows its picture on the left and its market on the right, all laid out. Copy or save any single picture. Download or copy the sheet when you want every selected picture in one image. Cards marked “Off the sheet” stay on the desk and off the sheet.

The feed beside each card mixes every source into one list, newest first:

- **Ended recently** on top: the eBay sold search, the TCGplayer market price, and Cardmarket sale averages (yesterday, 7-day, 30-day)
- **Live now**: eBay auctions ending soonest, then Buy It Now newest first (live listings need an eBay key; otherwise they open the eBay search)
- **Extra detail** (tucked away): price range, Cardmarket trend and low, Goldin, Facebook, Fanatics Collect and ALT searches, and a pin for a price you saw

Filters above the cards narrow the feed by source (All, TCGplayer, Cardmarket, eBay) and by condition (Raw, PSA, BGS, CGC, TAG, SGC, with a grade). The free feeds carry no graded prices, so the graded view opens eBay for that company and grade. Scrydex graded prices appear there when a Scrydex key is connected.

## Card pages

Every card, and every printing, has its own page: `/card/<id>` and `/card/<id>/reverse-holo`. Click a card name on the desk to open one. A card page has the card details, the same feed and filters, price charts, and Add to My Collection. Charts start with the Cardmarket 30-day, 7-day and yesterday averages. Charsi also saves each price it sees once a day (in `.data/history`, not committed), so the TCGplayer and Cardmarket lines fill in as you keep using it. No free source publishes older sales.

## My Collection

Add any card from the desk or a card page. Pick Raw, or Graded with a company and grade, and a number of copies. Raw and graded copies sit side by side in `/collection`, with tabs and a raw-copy market total. Entries are stored per user in `.data/collections` (not committed).

Sign in with Discord (free):

1. Create an application at https://discord.com/developers/applications.
2. Under OAuth2, add the redirect `http://localhost:4177/api/auth/discord/callback`.
3. Put the client ID and secret in `.env.local` as `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`, plus a long random `SESSION_SECRET`.

Until Discord is set up, local development uses a single “Local profile” so you can try everything. In production, sign-in is required and `SESSION_SECRET` must be set. Note that file storage only persists on a host with a writable disk.

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
| `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` | Live eBay auctions and Buy It Now in the feed |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` | Discord sign-in for My Collection |

Without those keys, pictures, matching, TCGplayer, and Cardmarket still work. Those numbers come from TCGdex: TCGplayer’s market price, and Cardmarket’s 1-day, 7-day, and 30-day sale averages. The date on each row is when that feed last refreshed, not a single auction. eBay sold listings stay a search until a sold-listings feed exists.

## Refresh the catalog

The matcher reads `data/catalog/pokemon.json`, a compact snapshot of the English Pokémon card catalog.

```bash
git clone --depth 1 https://github.com/PokemonTCG/pokemon-tcg-data.git /tmp/pokemon-tcg-data
POKEMON_TCG_DATA=/tmp/pokemon-tcg-data npm run catalog
```

## Another game

Add a catalog file under `data/catalog/`, teach `src/lib/catalog.ts` to load it, and point the Scrydex client in `src/lib/prices.ts` at that game’s path (`/magic/v1`, `/lorcana/v1`, and the others Scrydex already serves). The desk, the sheet, and the feed stay the same.
