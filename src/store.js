import { STORAGE_KEY } from "./constants.js";
import { defaultData } from "./default-data.js";

function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

export async function loadData() {
  const localData = localStorage.getItem(STORAGE_KEY);
  if (localData) {
    return JSON.parse(localData);
  }

  try {
    const response = await fetch("./data/data.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Die JSON-Daten konnten nicht geladen werden.");
    }

    return response.json();
  } catch {
    return cloneData(defaultData);
  }
}

export function persistData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function resetToSourceData() {
  localStorage.removeItem(STORAGE_KEY);
  return loadData();
}
