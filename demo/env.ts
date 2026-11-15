/** Env loading shared by the demo scripts. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const portalDir = resolve(here, "..");

/** Parse a .env file into a plain object. Blank values are kept as "". */
function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  let raw = "";
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

/** The portal's own .env.local: the only source of AUTH_SECRET and the Mapbox token. */
export const portalEnv = parseEnvFile(resolve(portalDir, ".env.local"));
/** Demo overrides: local database, blanked mail/SMS/Luma keys, separate build dir. */
export const demoEnv = parseEnvFile(resolve(here, ".env.demo"));

export const appUrl = demoEnv.AUTH_URL || "http://127.0.0.1:4020";
export const panelPort = Number(new URL(appUrl).port || 4020) + 1;
