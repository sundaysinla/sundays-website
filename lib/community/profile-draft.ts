import type { ProfileDraft, ViewerProfile } from "./types.ts";

/** Merge only the details explicitly selected in the private source review. */
export function applyReviewedDraft(profile: ViewerProfile, interests: string[], draft: ProfileDraft, selected: string[], useProject: boolean): ViewerProfile {
  const claims = draft.suggestions.filter(s => selected.includes(s.id));
  const combined = [...new Set([...interests, ...claims.map(c => c.value)])];
  if (combined.length > 12) throw new Error("Keep up to 12 interests. Remove a few before adding these.");
  return {
    ...profile, interests: combined,
    importedClaims: [...profile.importedClaims.filter(c => !claims.some(n => n.value === c.value)), ...claims].slice(-12),
    ...(useProject && draft.project ? {
      projectTitle: draft.project.title, projectSummary: draft.project.summary,
      importedProject: { ...draft.project, sourceLabel: draft.sourceLabel, fetchedAt: draft.fetchedAt },
    } : {}),
  };
}
