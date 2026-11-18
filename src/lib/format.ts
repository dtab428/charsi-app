const VARIANT_LABELS: Record<string, string> = {
  normal: "Non-holo",
  holofoil: "Holo",
  reverseHolofoil: "Reverse holo",
  "1stEditionHolofoil": "1st edition holo",
  "1stEditionNormal": "1st edition non-holo",
  "1stEdition": "1st edition non-holo",
  unlimitedHolofoil: "Unlimited holo",
  unlimited: "Unlimited non-holo",
  unlimitedNormal: "Unlimited non-holo",
  firstEditionHolofoil: "1st edition holo",
  firstEditionNormal: "1st edition non-holo",
  firstEditionShadowlessHolofoil: "1st edition shadowless",
  unlimitedShadowlessHolofoil: "Unlimited shadowless",
};

const FINISH_ORDER = ["normal", "holofoil", "reverseHolofoil"];

export function finishRank(key: string): number {
  const index = FINISH_ORDER.indexOf(key);
  return index === -1 ? FINISH_ORDER.length : index;
}

export type Finish = "normal" | "holo" | "reverse";
export type Edition = "first" | "shadowless" | "unlimited";

const STAMPED_SETS = new Set(["ex7", "ex8", "ex9", "ex10", "ex11", "ex12", "ex13", "ex14", "ex15", "ex16"]);

export function reverseStamp(setId: string | null | undefined): string {
  return setId && STAMPED_SETS.has(setId) ? setId : "";
}

export function editionOf(key: string | null | undefined): Edition | null {
  if (!key) return null;
  if (/shadowless/i.test(key)) return "shadowless";
  if (/1st|first/i.test(key)) return "first";
  if (/unlimited/i.test(key)) return "unlimited";
  return null;
}

export function finishOf(key: string | null | undefined): Finish | null {
  if (!key) return null;
  if (/reverse/i.test(key)) return "reverse";
  if (/holo/i.test(key)) return "holo";
  if (key === "normal" || editionOf(key)) return "normal";
  return null;
}

export function printingRank(key: string): number {
  const edition = editionOf(key);
  const finish = finishOf(key);
  const editionRank = edition === "first" ? 0 : edition === "shadowless" ? 1 : edition === "unlimited" ? 2 : 3;
  const finishOrder = finish === "normal" ? 0 : finish === "holo" ? 1 : finish === "reverse" ? 2 : 3;
  return editionRank * 10 + finishOrder;
}

export function withoutGenericEditions<T extends { key: string }>(variants: T[]): T[] {
  const editioned = (finish: Finish) => variants.some((variant) => finishOf(variant.key) === finish && editionOf(variant.key));
  return variants.filter((variant) => {
    const finish = finishOf(variant.key);
    if (!finish || editionOf(variant.key)) return true;
    return !editioned(finish);
  });
}

export function variantLabel(key: string): string {
  const known = VARIANT_LABELS[key];
  if (known) return known;
  const spaced = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/holofoil/gi, "holo")
    .replace(/[_-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function money(amount: number | null | undefined, currency: string): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const digits = Math.abs(amount) >= 200 ? 0 : 2;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    return `${amount.toFixed(digits)} ${currency}`;
  }
}

export function percent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function quoteDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})[/-](\d{2})[/-](\d{2})/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function endsLabel(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  const hours = Math.round((date.getTime() - Date.now()) / 36e5);
  if (hours <= 0) return `Ended ${when} ET`;
  const left = hours < 48 ? `${hours}h left` : `${Math.round(hours / 24)}d left`;
  return `${left} · ${when} ET`;
}

export function listedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 60) return `Listed ${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Listed ${hours}h ago`;
  return `Listed ${Math.round(hours / 24)}d ago`;
}

export function fileSlug(name: string, code: string, number: string): string {
  const base = `${name} ${code} ${number}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "card"}.png`;
}

export function sheetDate(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}
