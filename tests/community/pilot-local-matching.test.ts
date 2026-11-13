import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { LocalEmbeddings } from "../../lib/community/pilot/local-embeddings.ts";
import { matchLocally } from "../../lib/community/pilot/local-matching.ts";
import { matchPeople, matchingTexts, type Card, type Person } from "../../lib/community/pilot/matching.ts";
import { sampleDirectory } from "../../lib/community/pilot/sample.ts";

const viewer: Card = { name: "Alex", project: "Digitizing old family videos to preserve them.", portfolio: null };
const zoe: Person = { id: "zoe", card: { name: "Zoe", project: "Restoring and archiving damaged home movies.", portfolio: null } };
const modelDir = resolve(process.env.COMMUNITY_PILOT_MODEL_DIR || ".sundays-pilot/models/minilm-l6-v2");
const modelAvailable = existsSync(join(modelDir, "model_quantized.onnx")) &&
  existsSync(resolve("scripts/pilot-runtime/node_modules/onnxruntime-node"));

test("a missing model keeps the existing source-backed suggestions and directory working", async t => {
  const missing = mkdtempSync(join(tmpdir(), "sundays-missing-model-"));
  t.after(() => rmSync(missing, { recursive: true, force: true }));
  const result = await matchLocally(
    matcher => sampleDirectory("Blender", Date.now(), matcher),
    { COMMUNITY_PILOT_MODEL_DIR: missing },
  );
  assert.deepEqual(result.people.map(person => person.card.name), ["Casey Lin"]);
  assert.deepEqual(result.matches.map(match => match.person.card.name), ["Casey Lin", "Jamie Okafor"]);
});

test("the installed local model finds paraphrases, reuses vectors, and rechecks visibility", {
  skip: !modelAvailable && "Run npm run pilot:model to exercise the local ONNX model",
}, async () => {
  const unrelated: Person = { id: "mira", card: { name: "Mira", project: "Making ceramic cups.", portfolio: null } };
  const texts = matchingTexts([zoe, unrelated], viewer);
  const model = new LocalEmbeddings(modelDir);
  assert.deepEqual(matchPeople([zoe], viewer, "").matches, []);
  const vectors = await model.get(texts);
  assert.equal(vectors.size, texts.length);
  assert.equal(vectors.get(texts[0])?.length, 384);
  assert.ok(!(model.get(texts) instanceof Promise), "repeat reads should use the cache");
  const result = matchPeople([zoe, unrelated], viewer, "", vectors);
  assert.deepEqual(result.matches.map(match => match.person.id), ["zoe"]);
  assert.deepEqual(result.matches[0].yours, { text: viewer.project });
  assert.deepEqual(result.matches[0].theirs, { text: zoe.card.project });

  let people = [zoe];
  const request = matchLocally(matcher => ({
    ...matcher(people, viewer, ""), query: "", expiresAt: Date.now() + 60_000,
  }), { COMMUNITY_PILOT_MODEL_DIR: modelDir });
  people = [];
  assert.deepEqual((await request).matches, [], "a card hidden while inference runs must not return");
});

test("a shared browser extension format does not imply related work", {
  skip: !modelAvailable && "Run npm run pilot:model to exercise the local ONNX model",
}, async () => {
  const viewer: Card = {
    name: "Alex", project: "Building a Firefox extension to read recipes with a screen reader.", portfolio: null,
  };
  const unrelated: Person = {
    id: "mira", card: { name: "Mira", project: "Writing a Firefox extension to switch browser themes.", portfolio: null },
  };
  const model = new LocalEmbeddings(modelDir);
  const vectors = await model.get(matchingTexts([unrelated], viewer));
  assert.equal(vectors.size, 2);
  assert.deepEqual(matchPeople([unrelated], viewer, "", vectors).matches, []);
});
