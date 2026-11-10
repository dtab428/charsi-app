function letters(value: string): number {
  return (value.match(/[a-z]/gi) ?? []).length;
}

function cleanName(raw: string): string {
  const skip = /^(evolves|stage|basic|pokemon|trainer|energy|item|supporter|stadium|hp|lv|level)\b/i;
  const lines = raw
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/\b\d{1,4}\s*hp\b/gi, " ")
        .replace(/\b\d+\b/g, " ")
        .replace(/[^a-z0-9' ./#-]+/gi, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((line) => letters(line) >= 3 && !skip.test(line) && line.length <= 48);
  lines.sort((a, b) => letters(b) - letters(a) || a.length - b.length);
  return lines[0] ?? "";
}

const KEEP = new Set(["ex", "gx", "v", "vmax", "vstar", "break", "mega"]);

export function repairLine(line: string, known: (token: string) => boolean, complete: (token: string) => string | null): string {
  const tokens = line
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const next: string[] = [];
  for (const token of tokens) {
    if (/^\d+$/.test(token) || /^[a-z]{1,5}\d{1,4}$/.test(token)) {
      next.push(token);
      continue;
    }
    if (known(token) || KEEP.has(token)) {
      next.push(token);
      continue;
    }
    const fixed = token.length >= 5 ? complete(token) : null;
    if (fixed) next.push(fixed);
    else if (token.length > 3) next.push(token);
  }
  return next.join(" ");
}

export function collectorNumber(raw: string): string {
  const compact = raw.replace(/\s+/g, " ");
  const direct = /\b(\d{1,3})\s*[/|]\s*\d{1,3}\b/.exec(compact);
  if (direct?.[1]) return String(Number(direct[1]));
  const folded = compact.replace(/[oOQ]/g, "0").replace(/[ilI|!]/g, "1");
  const fuzzy = /\b(\d{1,3})\s*[/|]\s*\d{1,3}\b/.exec(folded);
  if (fuzzy?.[1]) return String(Number(fuzzy[1]));
  const code = /\b([A-Za-z]{1,5}\d{1,4})\s*[/|]\s*[A-Za-z]{0,5}\d{1,4}\b/.exec(compact);
  if (code?.[1]) return code[1];
  return "";
}

export function lineFromOcr(nameRaw: string, numberRaw: string): string {
  const name = cleanName(nameRaw);
  const number = collectorNumber(numberRaw) || collectorNumber(nameRaw);
  return [name, number].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
