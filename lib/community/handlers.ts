import { discover } from "./discovery.ts";
import { DEMO_MEMBERS, DEMO_VIEWER, DEMO_SESSION } from "./fixtures.ts";
import { discoverRequestSchema, importRequestSchema, withViewerProfile } from "./schemas.ts";
import { demoEnabled, requestJson, jsonResponse, errorResponse, CommunityError } from "./http.ts";
import { SampleGitHubAdapter, PublicGitHubAdapter } from "./imports.ts";

export async function handleDiscovery(request: Request, env: Record<string, string | undefined> = process.env): Promise<Response> {
  if (!demoEnabled(env)) return jsonResponse({ error: "This local preview is not enabled." }, 404);
  try {
    const input = discoverRequestSchema.safeParse(await requestJson(request));
    if (!input.success) throw new CommunityError("Check your profile and search. Searches can be up to 240 characters.");
    const { profile, ...options } = input.data;
    const viewer = withViewerProfile(DEMO_VIEWER, profile);
    return jsonResponse(discover(DEMO_MEMBERS, viewer, { ...options, sessionId: DEMO_SESSION.id }));
  } catch (error) { return errorResponse(error); }
}

export async function handleImport(request: Request, env: Record<string, string | undefined> = process.env): Promise<Response> {
  if (!demoEnabled(env)) return jsonResponse({ error: "This local preview is not enabled." }, 404);
  try {
    const parsed = importRequestSchema.safeParse(await requestJson(request));
    if (!parsed.success) throw new CommunityError("Check the source and username, then try again.");
    if (!parsed.data.consent) throw new CommunityError("Choose to use this source before importing a draft.", 403);
    if (parsed.data.mode === "public" && (env.NODE_ENV === "production" || env.COMMUNITY_GITHUB_IMPORT_ENABLED !== "true")) throw new CommunityError("Live GitHub import is off for this preview. Try the sample or write a short note.", 403);
    const adapter = parsed.data.mode === "sample" ? new SampleGitHubAdapter() : new PublicGitHubAdapter();
    return jsonResponse(await adapter.importProfile(parsed.data.username));
  } catch (error) { return errorResponse(error); }
}
