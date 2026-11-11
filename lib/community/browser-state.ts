import type { BrowserState } from "./types.ts";
import { browserStateSchema } from "./schemas.ts";
export const PROFILE_STORAGE_KEY = "sundays:meet:v1";
export function readBrowserState(storage: Pick<Storage, "getItem">): { state: BrowserState | null; recovered: boolean } {
  try {
    const raw = storage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return { state: null, recovered: false };
    const parsed = browserStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { state: parsed.data, recovered: false } : { state: null, recovered: true };
  } catch { return { state: null, recovered: true }; }
}
export function saveBrowserState(storage: Pick<Storage, "setItem">, state: BrowserState): boolean {
  try { storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(browserStateSchema.parse(state))); return true; }
  catch { return false; }
}
export function clearBrowserState(storage: Pick<Storage, "removeItem">): boolean {
  try { storage.removeItem(PROFILE_STORAGE_KEY); return true; } catch { return false; }
}
