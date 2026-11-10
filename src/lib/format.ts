const VARIANT_LABELS: Record<string, string> = {
  normal: "Normal",
  holofoil: "Holofoil",
  reverseHolofoil: "Reverse holo",
  "1stEditionHolofoil": "1st edition holo",
  "1stEditionNormal": "1st edition",
  unlimitedHolofoil: "Unlimited holo",
  unlimited: "Unlimited",
  firstEditionHolofoil: "1st edition holo",
  firstEditionNormal: "1st edition",
  firstEditionShadowlessHolofoil: "1st edition shadowless",
  unlimitedShadowlessHolofoil: "Unlimited shadowless",
};

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
