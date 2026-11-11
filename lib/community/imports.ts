import { z } from "zod";
import type { ProfileDraft, ProfileSourceAdapter, SourceClaim } from "./types.ts";
import { boundedJson, CommunityError } from "./http.ts";

const repositorySchema = z.object({
  name: z.string().max(100), description: z.string().nullable(), html_url: z.string().url(),
  language: z.string().nullable(), topics: z.array(z.string()).default([]),
  fork: z.boolean(), private: z.boolean(), owner: z.object({ login: z.string() }),
});
const accountSchema = z.object({ name: z.string().nullable(), login: z.string(), type: z.string() });

function validUsername(username: string): void {
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username) || username.includes("--")) throw new CommunityError("Enter a GitHub username, without a link or slash.");
}

function sourceUrl(raw: string, username: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.username || url.password || url.port) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length === 2 && parts[0].toLowerCase() === username.toLowerCase() ? url.origin + url.pathname : null;
  } catch { return null; }
}

function makeDraft(account: z.infer<typeof accountSchema>, rawRepos: unknown, source: ProfileDraft["source"]): ProfileDraft {
  if (account.type !== "User") throw new CommunityError("Choose a personal GitHub account for this profile.");
  const repositories = (Array.isArray(rawRepos) ? rawRepos.slice(0, 20) : [])
    .map(value => repositorySchema.safeParse(value))
    .filter(r => r.success).map(r => r.data!)
    .filter(r => !r.private && !r.fork && r.owner.login.toLowerCase() === account.login.toLowerCase())
    .map(r => ({ ...r, safeUrl: sourceUrl(r.html_url, account.login) }))
    .filter(r => r.safeUrl);
  const suggestions: SourceClaim[] = [];
  for (const repo of repositories) {
    // Repository metadata can suggest an interest; it cannot establish proficiency or willingness.
    for (const raw of [repo.language, ...repo.topics]) {
      const value = raw?.replace(/-/g, " ").trim().slice(0, 60);
      if (!value || suggestions.some(s => s.value.toLowerCase() === value.toLowerCase()) || suggestions.length >= 12) continue;
      suggestions.push({ id: `github-${suggestions.length}`, value, kind: "interest", sourceUrl: repo.safeUrl!, sourceLabel: `${repo.name} · ${repo.language === raw ? "repository language" : "repository topic"}` });
    }
  }
  const first = repositories[0];
  return {
    name: (account.name || account.login).slice(0, 80),
    project: first ? { title: first.name.slice(0, 80), summary: (first.description || "").slice(0, 300), sourceUrl: first.safeUrl! } : null,
    suggestions, source,
    sourceLabel: source === "sample-github" ? "fictional GitHub sample" : `GitHub · ${account.login}`,
    fetchedAt: new Date().toISOString(),
    notice: first ? "These are draft interests from repository metadata, not verified skills. Choose what feels like you." : "No original public projects were found. A short Sunday note is enough to get started.",
  };
}

export class SampleGitHubAdapter implements ProfileSourceAdapter {
  async importProfile(_username: string): Promise<ProfileDraft> {
    return makeDraft({ name: "Alex Rivera", login: "sundays-demo", type: "User" }, [
      { name: "a-first-cut", description: "A little tool that turns a voice memo into the first cut of a film.", html_url: "https://github.com/sundays-demo/a-first-cut", language: "TypeScript", topics: ["creative-coding", "audio", "generative-video"], fork: false, private: false, owner: { login: "sundays-demo" } },
      { name: "little-learning-tools", description: "Small experiments in learning together.", html_url: "https://github.com/sundays-demo/little-learning-tools", language: "Python", topics: ["education"], fork: false, private: false, owner: { login: "sundays-demo" } },
    ], "sample-github");
  }
}

export class PublicGitHubAdapter implements ProfileSourceAdapter {
  private fetcher: typeof fetch;
  constructor(fetcher: typeof fetch = fetch) { this.fetcher = fetcher; }

  async importProfile(username: string): Promise<ProfileDraft> {
    validUsername(username);
    const get = async (path: string) => {
      let response: Response;
      try {
        response = await this.fetcher(`https://api.github.com/users/${encodeURIComponent(username)}${path}`, {
          headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
          redirect: "error", cache: "no-store", signal: AbortSignal.timeout(5_000),
        });
      } catch { throw new CommunityError("GitHub could not be reached. Try again or write a short note instead.", 502); }
      if (response.status === 404) throw new CommunityError("That GitHub account was not found. Check the username.", 404);
      if (response.status === 403 || response.status === 429) throw new CommunityError("GitHub’s request limit was reached. Try later or write a short note instead.", 429);
      if (!response.ok) throw new CommunityError("GitHub could not load that account. Try later.", 502);
      return boundedJson(response, 524_288);
    };
    const rawAccount = await get("");
    const account = accountSchema.safeParse(rawAccount);
    if (!account.success || account.data.login.toLowerCase() !== username.toLowerCase()) throw new CommunityError("GitHub returned an account we could not read.", 502);
    if (account.data.type !== "User") throw new CommunityError("Choose a personal GitHub account for this profile.");
    const repos = await get("/repos?type=owner&sort=updated&direction=desc&per_page=20");
    return makeDraft(account.data, repos, "github");
  }
}
