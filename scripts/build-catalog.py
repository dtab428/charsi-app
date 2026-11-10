#!/usr/bin/env python3
"""Rebuild data/catalog/pokemon.json from a clone of PokemonTCG/pokemon-tcg-data.

    git clone --depth 1 https://github.com/PokemonTCG/pokemon-tcg-data.git /tmp/pokemon-tcg-data
    POKEMON_TCG_DATA=/tmp/pokemon-tcg-data python3 scripts/build-catalog.py
"""

import json
import os
from pathlib import Path

root = Path(os.environ.get("POKEMON_TCG_DATA", "/tmp/pokemon-tcg-data"))
sets = json.loads((root / "sets" / "en.json").read_text())
cards_dir = root / "cards" / "en"


def norm(value: str) -> str:
    return " ".join(value.lower().replace("é", "e").replace("—", " ").replace("–", " ").replace("'", "").split())


aliases: dict[str, list[str]] = {}


def add(phrase: str, set_id: str) -> None:
    key = norm(phrase)
    if not key:
        return
    bucket = aliases.setdefault(key, [])
    if set_id not in bucket:
        bucket.append(set_id)


for expansion in sets:
    add(expansion["name"], expansion["id"])
    if expansion.get("ptcgoCode"):
        add(expansion["ptcgoCode"], expansion["id"])
    add(expansion["id"], expansion["id"])

for phrase, set_id in {"base set": "base1", "pokemon 151": "sv3pt5", "pokemon go": "pgo"}.items():
    add(phrase, set_id)

cards = []
for path in sorted(cards_dir.glob("*.json")):
    for card in json.loads(path.read_text()):
        images = card.get("images") or {}
        legal = card.get("legalities") or {}
        dex = card.get("nationalPokedexNumbers") or []
        attacks = [attack.get("name") for attack in card.get("attacks") or [] if attack.get("name")][:3]
        cards.append(
            {
                "id": card["id"],
                "name": card["name"],
                "super": card.get("supertype") or "",
                "subs": card.get("subtypes") or [],
                "hp": card.get("hp") or "",
                "types": card.get("types") or [],
                "set": path.stem,
                "num": card.get("number") or "",
                "rarity": card.get("rarity") or "",
                "artist": card.get("artist") or "",
                "dex": dex[0] if dex else None,
                "reg": card.get("regulationMark") or "",
                "small": images.get("small") or "",
                "large": images.get("large") or images.get("small") or "",
                "attacks": attacks,
                "standard": legal.get("standard") or "",
                "expanded": legal.get("expanded") or "",
            }
        )

payload = {
    "game": "pokemon",
    "generatedFrom": "PokemonTCG/pokemon-tcg-data",
    "cardCount": len(cards),
    "sets": [
        {
            "id": expansion["id"],
            "name": expansion["name"],
            "series": expansion.get("series") or "",
            "code": expansion.get("ptcgoCode") or "",
            "printed": expansion.get("printedTotal") or 0,
            "total": expansion.get("total") or 0,
            "released": expansion.get("releaseDate") or "",
            "symbol": (expansion.get("images") or {}).get("symbol") or "",
        }
        for expansion in sets
    ],
    "aliases": [
        {"phrase": phrase, "sets": set_ids}
        for phrase, set_ids in sorted(aliases.items(), key=lambda item: (-len(item[0].split()), -len(item[0]), item[0]))
    ],
    "cards": cards,
}

destination = Path(__file__).resolve().parents[1] / "data" / "catalog" / "pokemon.json"
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False))
print(f"wrote {len(cards)} cards to {destination}")
