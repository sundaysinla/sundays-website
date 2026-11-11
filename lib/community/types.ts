export type Scope = "today" | "community";
export type Discipline = "technology" | "film" | "music" | "design" | "craft" | "writing" | "research" | "general";
export type Campus = "USC" | "UCLA" | "Los Angeles";
export type Visibility = "private" | "session" | "community";

export interface CommunityProject {
  id: string;
  title: string;
  summary: string;
  topics: string[];
  period: "current" | "last-semester";
  origin: "demo" | "project-garden" | "luma-rsvp";
}

export interface Member {
  id: string;
  name: string;
  practice: string;
  discipline: Discipline;
  campus?: Campus;
  link?: string;
  bio: string;
  interests: string[];
  offers: string[];
  asks: string[];
  project: CommunityProject;
  visibility: Visibility;
  review: "approved" | "draft" | "withdrawn";
  reviewedAt: string;
  attendance: { sessionId: string; status: "checked-in" | "rsvp" | "cancelled" }[];
  openToMeet: boolean;
  sourceLabel: string;
}

export interface PublicMember {
  id: string;
  name: string;
  practice: string;
  discipline: Discipline;
  campus?: Campus;
  link?: string;
  bio: string;
  interests: string[];
  offers: string[];
  asks: string[];
  project: CommunityProject;
  presence: "here" | "focusing" | "away";
  sourceLabel: string;
  reviewedAt: string;
}

export interface Evidence {
  field: "offers" | "asks" | "interests" | "project" | "practice";
  excerpt: string;
}

export interface DiscoveryMatch {
  member: PublicMember;
  connection: string;
  reason: string;
  starter: string;
  evidence: Evidence[];
  differentPractice: boolean;
  metBefore: boolean;
}

export interface DiscoveryOptions {
  scope: Scope;
  sessionId: string;
  query?: string;
  mode?: "recommended" | "surprise";
  seed?: number;
  metIds?: string[];
}

export interface DiscoveryResult {
  matches: DiscoveryMatch[];
  counts: { today: number; community: number };
  query: string;
  interpretation: string;
  restrictedQuery: boolean;
}

export interface SourceClaim {
  id: string;
  value: string;
  kind: "interest";
  sourceUrl: string;
  sourceLabel: string;
}

export interface ProfileDraft {
  name: string;
  project: { title: string; summary: string; sourceUrl: string } | null;
  suggestions: SourceClaim[];
  source: "sample-github" | "github";
  sourceLabel: string;
  fetchedAt: string;
  notice: string;
}

export interface ProfileSourceAdapter {
  importProfile(username: string): Promise<ProfileDraft>;
}

export interface ViewerProfile {
  name: string;
  practice: string;
  discipline: Discipline;
  campus: Campus;
  bio: string;
  interests: string[];
  offers: string[];
  asks: string[];
  projectTitle: string;
  projectSummary: string;
  visibility: Visibility;
  openToMeet: boolean;
  importedClaims: SourceClaim[];
  importedProject: (NonNullable<ProfileDraft["project"]> & { sourceLabel: string; fetchedAt: string }) | null;
}

export interface BrowserState {
  version: 1;
  profile: ViewerProfile | null;
  metIds: string[];
  feedback: Record<string, "worthwhile" | "not-quite">;
}
