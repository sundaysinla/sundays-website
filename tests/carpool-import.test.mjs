import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { normalizePhone, formatPhone } from "../lib/phone.ts";
import { parseSheet, parseRows, parseRole, matchesDriver, hasNameColumn } from "../lib/carpool/import-parse.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const template = readFileSync(path.join(here, "..", "public", "carpool-import-template.csv"));

test("normalizePhone handles US formats and rejects junk", () => {
  assert.equal(normalizePhone("(310) 555-0101"), "+13105550101");
  assert.equal(normalizePhone("310.555.0101"), "+13105550101");
  assert.equal(normalizePhone("1 310 555 0101"), "+13105550101");
  assert.equal(normalizePhone("+44 20 7946 0958"), "+442079460958");
  assert.equal(normalizePhone("555-0101"), null);
  assert.equal(normalizePhone("call me"), null);
  assert.equal(formatPhone("+13105550101"), "(310) 555-0101");
});

test("parseRole reads driver / rider loosely and falls back on seats", () => {
  assert.equal(parseRole("Driver", null), "driver");
  assert.equal(parseRole("can drive", null), "driver");
  assert.equal(parseRole("needs a ride", null), "rider");
  assert.equal(parseRole("", 3), "driver");
  assert.equal(parseRole("", null), "rider");
});

test("the template parses into the expected rows", () => {
  const { headers, records } = parseSheet(new Uint8Array(template));
  assert.ok(hasNameColumn(headers));
  const rows = parseRows(records);
  assert.equal(rows.length, 5);

  const emily = rows.find((r) => r.name === "Emily Shen");
  assert.equal(emily.role, "driver");
  assert.equal(emily.seats, 3);
  assert.equal(emily.phone, "+13105550101");
  assert.equal(emily.email, "emily@ucla.edu");

  const kai = rows.find((r) => r.name === "Kai Davey");
  assert.equal(kai.role, "rider");
  assert.equal(kai.car, "Emily Shen");
  assert.equal(kai.seats, null);

  const maia = rows.find((r) => r.name === "Maia Rocha");
  assert.equal(maia.car, null);
  assert.deepEqual(maia.issues, []);
  assert.equal(rows.every((r) => !r.skip), true);
});

test("duplicate names in a file skip the second copy", () => {
  const rows = parseRows([
    { name: "Sam Cheng", role: "driver", seats: "2" },
    { name: "sam cheng", role: "rider" },
  ]);
  assert.equal(rows[0].skip, false);
  assert.equal(rows[1].skip, true);
});

test("header aliases: 'Full name' / 'Pickup' / 'Cell' are understood", () => {
  const rows = parseRows([{ fullname: "Ada Lovelace", pickup: "USC Village", cell: "(213) 555-0000", type: "rider" }]);
  assert.equal(rows[0].name, "Ada Lovelace");
  assert.equal(rows[0].address, "USC Village");
  assert.equal(rows[0].phone, "+12135550000");
});

test("matchesDriver accepts full or first name", () => {
  assert.ok(matchesDriver("Emily Shen", ["Emily Shen"]));
  assert.ok(matchesDriver("emily", ["Emily Shen"]));
  assert.ok(!matchesDriver("Sam", ["Emily Shen"]));
});
