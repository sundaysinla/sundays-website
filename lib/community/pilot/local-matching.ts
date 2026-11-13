import { localEmbeddings, type Vectors } from "./local-embeddings.ts";
import { matchPeople, matchingTexts, type PilotMatcher } from "./matching.ts";
import type { PilotDiscovery } from "./store.ts";

export async function matchLocally(
  read: (matcher: PilotMatcher) => PilotDiscovery,
  env: Record<string, string | undefined>,
) {
  let pending: Promise<Vectors> | undefined;
  const result = read((people, viewer, query) => {
    const embeddings = viewer && people.length ? localEmbeddings(env) : undefined;
    if (!viewer || !embeddings) return matchPeople(people, viewer, query);
    const vectors = embeddings.get(matchingTexts(people, viewer));
    if (vectors instanceof Promise) {
      pending = vectors;
      return { people: [], matches: [] };
    }
    return matchPeople(people, viewer, query, vectors);
  });
  if (!pending) return result;
  const vectors = await pending;
  // Reapply current consent, check-in and session expiry after the worker has run.
  return read((people, viewer, query) => matchPeople(people, viewer, query, vectors));
}
