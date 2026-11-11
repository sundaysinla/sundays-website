import test from "node:test";
import assert from "node:assert/strict";
import { readBrowserState, saveBrowserState, clearBrowserState, PROFILE_STORAGE_KEY } from "../../lib/community/browser-state.ts";
import { toViewerProfile } from "../../lib/community/schemas.ts";
import { DEMO_VIEWER } from "../../lib/community/fixtures.ts";
import type { BrowserState } from "../../lib/community/types.ts";
import { SampleGitHubAdapter } from "../../lib/community/imports.ts";
import { applyReviewedDraft } from "../../lib/community/profile-draft.ts";

const state: BrowserState = { version: 1, profile: toViewerProfile(DEMO_VIEWER), metIds: ["maya"], feedback: { maya: "worthwhile" } };
function storage(initial: string | null = null) {
  let value = initial;
  return { getItem: (_key: string) => value, setItem: (_key: string, next: string) => { value = next; }, removeItem: (_key: string) => { value = null; } };
}

test("browser-only profile, meetings and feedback survive a validated round trip", () => {
  const store = storage();
  assert.equal(saveBrowserState(store, state), true);
  assert.deepEqual(readBrowserState(store).state, state);
});
test("corrupt, outdated and invalid stored state never crashes or becomes a profile", () => {
  for (const raw of ["{", "null", JSON.stringify({ ...state, version: 99 }), JSON.stringify({ ...state, profile: { name: "incomplete" } })]) {
    assert.equal(readBrowserState(storage(raw)).state, null);
    assert.equal(readBrowserState(storage(raw)).recovered, true);
  }
});
test("storage denial is recoverable", () => {
  const denied = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } };
  assert.equal(readBrowserState(denied).state, null);
  assert.equal(saveBrowserState(denied, state), false);
  assert.equal(clearBrowserState(denied), false);
});
test("reset deletes the local profile, imported claims, meetings and feedback", () => {
  const store = storage(JSON.stringify(state));
  assert.equal(clearBrowserState(store), true);
  assert.equal(store.getItem(PROFILE_STORAGE_KEY), null);
  assert.equal(readBrowserState(store).recovered, false);
});

test("a project-only import keeps provenance through edits, save and reload", async () => {
  const draft = await new SampleGitHubAdapter().importProfile("demo-maker");
  const merged = applyReviewedDraft(toViewerProfile(DEMO_VIEWER), [], draft, [], true);
  merged.projectTitle = "My edited title";
  assert.equal(merged.importedClaims.length, 0);
  assert.equal(merged.importedProject?.sourceUrl, draft.project?.sourceUrl);
  const store = storage();
  saveBrowserState(store, { ...state, profile: merged });
  const restored = readBrowserState(store).state!.profile!;
  assert.equal(restored.projectTitle, "My edited title");
  assert.equal(restored.importedProject?.title, draft.project?.title);
  assert.equal(restored.importedProject?.fetchedAt, draft.fetchedAt);
  assert.equal(restored.importedProject?.sourceLabel, "fictional GitHub sample");
  clearBrowserState(store);
  assert.equal(store.getItem(PROFILE_STORAGE_KEY), null);
});

test("unselected details never enter the profile during source review", async () => {
  const draft = await new SampleGitHubAdapter().importProfile("demo-maker");
  const original = toViewerProfile(DEMO_VIEWER);
  assert.deepEqual(applyReviewedDraft(original, original.interests, draft, [], false), original);
});
