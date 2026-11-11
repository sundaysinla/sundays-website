import test from "node:test";
import assert from "node:assert/strict";
import { SampleGitHubAdapter, PublicGitHubAdapter } from "../../lib/community/imports.ts";

const repo = { name: "voice-notes", description: "An audio tool", html_url: "https://github.com/demo-maker/voice-notes", language: "TypeScript", topics: ["creative-coding", "audio"], fork: false, private: false, owner: { login: "demo-maker" } };
const data = (repos: unknown[] = [repo], profile = { name: "Demo Maker", login: "demo-maker", type: "User" }) => async (input: string | URL | Request) => {
  const url = String(input);
  return new Response(JSON.stringify(url.includes("/repos?") ? repos : profile), { headers: { "Content-Type": "application/json" } });
};

test("sample import creates provenance-bearing draft suggestions without skills or publication", async () => {
  const draft = await new SampleGitHubAdapter().importProfile("demo-maker");
  assert.ok(draft.suggestions.length > 0);
  assert.equal(draft.source, "sample-github");
  assert.ok(draft.suggestions.every(s => s.kind === "interest" && s.sourceUrl.startsWith("https://github.com/")));
  assert.ok(!("offers" in draft));
  assert.ok(!("visibility" in draft));
});

test("public import only requests the fixed GitHub API host and refuses redirects", async () => {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const adapter = new PublicGitHubAdapter(async (input, init) => { calls.push({ url: String(input), init }); return data()(input); });
  const draft = await adapter.importProfile("demo-maker");
  assert.equal(calls.length, 2);
  assert.ok(calls.every(c => new URL(c.url).hostname === "api.github.com" && c.init?.redirect === "error"));
  assert.equal(draft.project?.title, "voice-notes");
});

test("usernames cannot become arbitrary fetch URLs", async () => {
  for (const name of ["http://127.0.0.1", "../admin", "demo/foo", "a?x=1", "-bad", "a".repeat(40)]) {
    let called = false;
    await assert.rejects(() => new PublicGitHubAdapter(async () => { called = true; return new Response("{}"); }).importProfile(name));
    assert.equal(called, false);
  }
});

test("private, forked, unrelated-owner and unsafe source URL repositories never become claims", async () => {
  const repos = [
    { ...repo, private: true, topics: ["secret"] },
    { ...repo, fork: true, topics: ["forked"] },
    { ...repo, owner: { login: "other" }, topics: ["unowned"] },
    { ...repo, html_url: "javascript:alert(1)", topics: ["unsafe"] },
    { ...repo, html_url: "https://github.com.evil.test/foo", topics: ["spoofed"] },
  ];
  const draft = await new PublicGitHubAdapter(data(repos)).importProfile("demo-maker");
  assert.equal(draft.project, null);
  assert.equal(draft.suggestions.length, 0);
});

test("metadata never guesses willingness, ability, school, or sensitive attributes", async () => {
  const draft = await new PublicGitHubAdapter(data()).importProfile("demo-maker");
  assert.ok(draft.suggestions.every(s => s.kind === "interest"));
  assert.ok(!("campus" in draft));
  assert.ok(!("offers" in draft));
  assert.ok(!("openToMeet" in draft));
});

test("rate limits and missing accounts return actionable import errors", async () => {
  for (const status of [403, 404, 429]) {
    await assert.rejects(() => new PublicGitHubAdapter(async () => new Response("{}", { status })).importProfile("demo-maker"), /limit|account|found/i);
  }
});

test("oversized source response is bounded", async () => {
  await assert.rejects(() => new PublicGitHubAdapter(async () => new Response("x".repeat(600_000))).importProfile("demo-maker"), /large|limit/i);
});

test("organization accounts are not imported as people", async () => {
  await assert.rejects(() => new PublicGitHubAdapter(data([], { name: "Demo Org", login: "demo-maker", type: "Organization" })).importProfile("demo-maker"), /personal|person|account/i);
});
