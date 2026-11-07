// Existing SQLite values are ISO instants. SQLite's legacy space-separated form is UTC.
export function parseItemInstant(value: string): Date | null {
  const normalized = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?:\.\d+)?$/.test(value) ? value.replace(" ", "T") + "Z" : value;
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(normalized)) return null;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatItemInstant(value: string, locale: string, timeZone?: string): string | null {
  const date = parseItemInstant(value);
  return date ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", ...(timeZone ? { timeZone } : {}) }).format(date) : null;
}

export function hasMeaningfulUpdate(created: string, updated: string): boolean {
  const first = parseItemInstant(created), last = parseItemInstant(updated);
  return Boolean(first && last && last.getTime() > first.getTime());
}
