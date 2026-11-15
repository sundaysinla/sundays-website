/**
 * Pure spreadsheet parsing for the host import. No database, no network, so
 * `npm test` can run it against the template file.
 */

import * as XLSX from "xlsx";
import { normalizePhone } from "../phone.ts";

export type ParsedRow = {
  row: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: "driver" | "rider";
  address: string | null;
  seats: number | null;
  notes: string | null;
  car: string | null;
  issues: string[];
  skip: boolean;
};

const ALIASES = {
  name: ["name", "fullname", "person", "who", "member"],
  email: ["email", "emailaddress", "mail"],
  phone: ["phone", "phonenumber", "cell", "cellphone", "mobile", "number", "tel"],
  role: ["role", "type", "driverrider", "drivingorriding", "driverorrider", "status"],
  address: ["address", "pickup", "pickupaddress", "startaddress", "location", "from", "where"],
  seats: ["seats", "seatsavailable", "capacity", "openseats"],
  notes: ["notes", "note", "comments", "comment"],
  car: ["car", "driver", "ridewith", "assignedto", "assign", "withdriver"],
} as const;

export function normHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function hasNameColumn(headers: string[]) {
  return headers.some((h) => (ALIASES.name as readonly string[]).includes(normHeader(h)));
}

export function parseRole(raw: string, seats: number | null): "driver" | "rider" {
  const v = raw.toLowerCase();
  if (/driv|can drive|offer/.test(v)) return "driver";
  if (/rid|need|passeng|pickup|pick up/.test(v)) return "rider";
  return seats && seats > 0 ? "driver" : "rider";
}

export function parseSheet(data: ArrayBuffer | Uint8Array | Buffer): { headers: string[]; records: Record<string, string>[] } {
  const wb = XLSX.read(data instanceof ArrayBuffer ? new Uint8Array(data) : data, { type: data instanceof ArrayBuffer || data instanceof Uint8Array ? "array" : "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("The file has no sheets");
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const records = rows.map((r) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) out[normHeader(k)] = v == null ? "" : String(v).trim();
    return out;
  });
  return { headers, records };
}

function pick(record: Record<string, string>, key: keyof typeof ALIASES): string {
  for (const alias of ALIASES[key]) {
    if (record[alias] != null && record[alias] !== "") return record[alias];
  }
  return "";
}

/** Rows with basic validation and in-file duplicate detection. Nothing geocoded yet. */
export function parseRows(records: Record<string, string>[]): ParsedRow[] {
  const rows: ParsedRow[] = records.map((r, i) => {
    const seatsRaw = pick(r, "seats");
    const seats = seatsRaw ? Number(seatsRaw.replace(/\D/g, "")) || null : null;
    const role = parseRole(pick(r, "role"), seats);
    const phoneRaw = pick(r, "phone");
    const email = pick(r, "email").toLowerCase() || null;
    const issues: string[] = [];
    const name = pick(r, "name");
    if (!name) issues.push("No name");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push(`Email "${email}" doesn't look valid`);
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    if (phoneRaw && !phone) issues.push(`Phone "${phoneRaw}" doesn't look valid; will be left blank`);
    return {
      row: i + 2, // 1-based, after the header
      name,
      email,
      phone,
      role,
      address: pick(r, "address") || null,
      seats: role === "driver" ? Math.max(1, Math.min(8, seats ?? 3)) : null,
      notes: pick(r, "notes") || null,
      car: role === "rider" ? pick(r, "car") || null : null,
      issues,
      skip: !name,
    };
  });

  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.name) continue;
    const key = r.name.toLowerCase();
    if (seen.has(key)) {
      r.issues.push("Appears twice in the file; second copy skipped");
      r.skip = true;
    }
    seen.add(key);
  }
  return rows;
}

/** Does `car` name one of these drivers (full name or first name)? */
export function matchesDriver(car: string, driverNames: Iterable<string>) {
  const ck = car.trim().toLowerCase();
  for (const d of driverNames) {
    const dk = d.trim().toLowerCase();
    if (dk === ck || dk.split(/\s+/)[0] === ck) return true;
  }
  return false;
}
