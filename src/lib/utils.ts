import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ------------------------------------------------------------------ *
 * Currency — values are stored in a USD base and rendered in the
 * workspace's active currency (USD or INR). The active currency is a
 * module singleton kept in sync by CurrencyProvider so the 40+ existing
 * formatCurrency() call sites convert automatically.
 * ------------------------------------------------------------------ */
export type Currency = "USD" | "INR";

export const CURRENCY_META: Record<Currency, { symbol: string; locale: string; rate: number; compactFrom: number }> = {
  USD: { symbol: "$", locale: "en-US", rate: 1, compactFrom: 10_000 },
  INR: { symbol: "₹", locale: "en-IN", rate: 83, compactFrom: 100_000 },
};

let activeCurrency: Currency = "INR";
export function setActiveCurrency(c: Currency) {
  activeCurrency = c;
}
export function getActiveCurrency(): Currency {
  return activeCurrency;
}

/** Convert an amount typed in the active (or given) currency into the USD storage base. */
export function toBaseUSD(amount: number, currency: Currency = activeCurrency) {
  return amount / CURRENCY_META[currency].rate;
}
/** Convert a USD-base amount into the active (or given) currency for display/editing. */
export function fromBaseUSD(usd: number, currency: Currency = activeCurrency) {
  return usd * CURRENCY_META[currency].rate;
}

// Indian (Cr/L/K) vs Western (B/M/K) compact tiers — computed manually so the
// output is byte-identical on Node (SSR) and the browser, avoiding the ICU
// compact-notation differences that cause hydration mismatches.
const COMPACT_TIERS: Record<Currency, [number, string][]> = {
  USD: [[1e9, "B"], [1e6, "M"], [1e3, "K"]],
  INR: [[1e7, "Cr"], [1e5, "L"], [1e3, "K"]],
};

function trimZero(s: string) {
  return s.replace(/\.0$/, "");
}

/** Format a USD-base number as compact currency in the active (or given) currency. */
export function formatCurrency(
  value: number,
  opts?: { compact?: boolean; currency?: Currency }
) {
  const currency = opts?.currency ?? activeCurrency;
  const { symbol, locale, rate, compactFrom } = CURRENCY_META[currency];
  const converted = value * rate;
  const compact = opts?.compact ?? Math.abs(converted) >= compactFrom;

  if (compact) {
    const abs = Math.abs(converted);
    const sign = converted < 0 ? "-" : "";
    for (const [threshold, suffix] of COMPACT_TIERS[currency]) {
      if (abs >= threshold) {
        const n = abs / threshold;
        const s = n >= 100 ? String(Math.round(n)) : trimZero(n.toFixed(1));
        return `${sign}${symbol}${s}${suffix}`;
      }
    }
    return `${sign}${symbol}${Math.round(abs)}`;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(converted);
}

export function formatNumber(value: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number, digits = 1) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...opts,
  }).format(new Date(date));
}

export function relativeTime(date: string | Date) {
  const d = new Date(date).getTime();
  const now = Date.now();
  const diff = Math.round((d - now) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(diff / 86400), "day");
  if (abs < 2629800) return rtf.format(Math.round(diff / 604800), "week");
  return rtf.format(Math.round(diff / 2629800), "month");
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Deterministic color index for avatars/charts from a string */
export function hashIndex(str: string, modulo: number) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h) % modulo;
}
