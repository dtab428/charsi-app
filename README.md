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

Filters above the cards narrow the feed by source (All, TCGplayer, Cardmarket, eBay) and by condition (Raw, PSA, BGS, CGC, TAG, SGC, with a grade). Choosing a company draws that company’s slab around the card picture, with the grade on the label. The free feeds carry no graded prices, so the graded view opens eBay for that company and grade. Scrydex graded prices appear there when a Scrydex key is connected. On a wide screen, Per row switches the desk between one card and two.

Finishes follow TCGplayer. A card can be non-holo, holo, and reverse holo at once. Reverse holo is the stamped printing and almost never has its own scan, so that page keeps the shared picture and places a small seal on the usual stamp spot (lower right of the artwork). The line under the picture says it is placed, not a photograph of the stamped card. Full arts and some trainers put the art somewhere else, so the seal can sit in the wrong place on those. Holo, when TCGplayer files it as its own product (often under Deck Exclusives), is loaded beside the other two. Pictures themselves come from the public card CDNs (images.pokemontcg.io, and TCGplayer’s image host for a holo product). They are not stored in this repo. If a browser can’t reach the CDN, the app asks our server to fetch that one picture. Search results use the full set name.

## Card pages

Every card, and every printing, has its own page: `/card/<id>` and `/card/<id>/reverse-holo`. Click a card name on the desk to open one. A card page has the card details, the same feed and filters, price charts, and Save a copy. Charts start with the Cardmarket 30-day, 7-day and yesterday averages. Charsi also saves each price it sees once a day (in `.data/history`, not committed), so the TCGplayer and Cardmarket lines fill in as you keep using it. No free source publishes older sales.

## My Collection

Save a copy from the desk or a card page. Pick Raw, or Graded with a company and grade, a printing, and a number of copies, then send it to My Collection or My Wishlist. A wishlist entry can be one exact thing, such as a TAG 7 reverse holo. Both lists sit at `/collection` and `/wishlist`, with Raw and Graded tabs plus filters for set, year, and artist. A graded copy is drawn as that company’s slab with the card picture in the window. Entries are stored per user in `.data/collections` and `.data/wishlists` (not committed).

Sign in with Discord (free):

1. Create an application at https://discord.com/developers/applications.
2. Under OAuth2, add the redirect `http://localhost:4177/api/auth/discord/callback`.
3. Put the client ID and secret in `.env.local` as `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`, plus a long random `SESSION_SECRET`.

Saving to My Collection or My Wishlist needs a Discord sign-in, locally and in production. `.env.local` is not in git, so every machine and every host (Vercel included) needs the three values set in its own environment. On a host with a read-only disk, such as Vercel, saved lists need a database before they persist.

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
| `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` | eBay auctions and Buy It Now in the feed. A sandbox key (SBX) talks to eBay’s test site, which has no live Pokémon sales. A production key lists real auctions. `EBAY_DEV_ID` is unused by this feed. |
| `NEXT_PUBLIC_EBAY_CAMPAIGN_ID` | eBay Partner Network campaign id. Search and listing links then carry it, so a purchase can credit you. Blank leaves the link plain. |
| `NEXT_PUBLIC_TCGPLAYER_PARTNER_LINK` | Your Impact partner link for TCGplayer (`https://partner.tcgplayer.com/c/...`). Product and search links are wrapped with it. Cardmarket has no equivalent link program. |
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
