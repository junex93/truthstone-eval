/**
 * Deterministic URL canonicalization. Pure, testable, no network.
 *
 * A source is identified by its canonical URL: two links that differ only by
 * tracking parameters are the SAME source and must not become two independent
 * comparables (constitutional rule PROPERTY != LISTING and duplicate review).
 */

const TRACKING_PARAM_PREFIXES = ["utm_", "pk_", "mtm_", "_hs"];
const TRACKING_PARAM_NAMES = new Set([
  "gclid",
  "fbclid",
  "msclkid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref",
  "referrer",
  "source",
  "cmpid",
  "campaignid",
  "gad_source",
  "yclid",
  "spm",
]);

export interface CanonicalUrl {
  url: string;
  canonicalUrl: string;
  domain: string;
}

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  if (TRACKING_PARAM_NAMES.has(lower)) return true;
  return TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/** Registrable-ish host: lowercase, no trailing dot, no leading "www.". */
export function extractDomain(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  let host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (host.startsWith("www.")) host = host.slice(4);
  return host;
}

export function canonicalizeUrl(rawUrl: string): CanonicalUrl {
  const trimmed = rawUrl.trim();
  if (trimmed === "") throw new Error("URL vazia.");

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`URL inválida: ${rawUrl}`);
  }

  const scheme = parsed.protocol.toLowerCase();
  if (scheme !== "http:" && scheme !== "https:") {
    throw new Error(`Esquema de URL não suportado: ${parsed.protocol}`);
  }

  parsed.protocol = scheme;
  parsed.hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  parsed.hash = "";
  parsed.username = "";
  parsed.password = "";
  if (
    (scheme === "http:" && parsed.port === "80") ||
    (scheme === "https:" && parsed.port === "443")
  ) {
    parsed.port = "";
  }

  const kept: Array<[string, string]> = [];
  parsed.searchParams.forEach((value, key) => {
    if (!isTrackingParam(key)) kept.push([key, value]);
  });
  kept.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));

  const search = kept.length > 0 ? new URLSearchParams(kept).toString() : "";
  let pathname = parsed.pathname.replace(/\/{2,}/g, "/");
  if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);

  const canonicalUrl = `${scheme}//${parsed.host}${pathname}${search ? `?${search}` : ""}`;

  return { url: trimmed, canonicalUrl, domain: extractDomain(canonicalUrl) };
}

/** Same source? Compared by canonical URL only, never by title or snippet. */
export function isSameSource(a: string, b: string): boolean {
  try {
    return canonicalizeUrl(a).canonicalUrl === canonicalizeUrl(b).canonicalUrl;
  } catch {
    return false;
  }
}

/** Storage-safe file name for a captured page. */
export function captureFileName(canonicalUrl: string, extension = "txt"): string {
  const slug = canonicalUrl
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120)
    .toLowerCase();
  return `${slug || "captura"}.${extension}`;
}
