export const UPDATES_KEY = "ark-library:updates:v1";
export function hasUnreadChapter(latest: string | null, progress: string, dismissed?: number) {
  if (!latest || !/^\d+(?:\.\d+)?$/.test(latest)) return false;
  const number = Number(latest);
  const read = /^\d+(?:\.\d+)?$/.test(progress) ? Number(progress) : -1;
  return number > read && (dismissed === undefined || number > dismissed);
}
export function readDismissed(storage: Pick<Storage, "getItem"> = localStorage): Record<string, number> {
  try {
    const value = JSON.parse(storage.getItem(UPDATES_KEY) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key, n]) =>
      /^[a-f\d-]{36}:(pt-br|en)$/i.test(key) && typeof n === "number" && Number.isFinite(n) && n >= 0)) as Record<string, number>;
  } catch { return {}; }
}
