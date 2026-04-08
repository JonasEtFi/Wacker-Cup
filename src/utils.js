export function createId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function monthKeyFromDate(dateString) {
  return dateString.slice(0, 7);
}

export function formatMonth(monthKey) {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatDate(dateString) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(dateString));
}

export function getCurrentMonthKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

export async function sha256(value) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

export function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function sortByDateDesc(items, accessor) {
  return [...items].sort((left, right) => accessor(right).localeCompare(accessor(left)));
}
