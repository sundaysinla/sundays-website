import { z } from "zod";
import type { Member, ViewerProfile } from "./types.ts";

const short = z.string().trim().min(1).max(60);
const list = z.array(short).max(12);
const githubUrl = z.string().url().max(250).refine(url => { try { const parsed = new URL(url); return parsed.protocol === "https:" && parsed.hostname === "github.com" && !parsed.username && !parsed.password && !parsed.port; } catch { return false; } });
export const claimSchema = z.object({
  id: z.string().max(100), value: short, kind: z.literal("interest"),
  sourceUrl: githubUrl,
  sourceLabel: z.string().max(120),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80), practice: short,
  discipline: z.enum(["technology", "film", "music", "design", "craft", "writing", "research", "general"]),
  campus: z.enum(["USC", "UCLA", "Los Angeles"]),
  bio: z.string().trim().max(180),
  interests: list, offers: list, asks: list,
  projectTitle: z.string().trim().min(1).max(80),
  projectSummary: z.string().trim().min(1).max(300),
  visibility: z.enum(["private", "session", "community"]), openToMeet: z.boolean(),
  importedClaims: z.array(claimSchema).max(12).default([]),
  importedProject: z.object({
    title: z.string().min(1).max(80), summary: z.string().max(300),
    sourceUrl: githubUrl, sourceLabel: z.string().max(120), fetchedAt: z.string().datetime(),
  }).nullable().default(null),
});

export const discoverRequestSchema = z.object({
  scope: z.enum(["today", "community"]).default("today"),
  query: z.string().trim().max(240).default(""),
  mode: z.enum(["recommended", "surprise"]).default("recommended"),
  seed: z.number().int().min(0).max(1_000_000).default(0),
  metIds: z.array(z.string().regex(/^[a-z0-9-]{1,64}$/)).max(100).default([]),
  profile: profileSchema.optional(),
});

export const importRequestSchema = z.object({
  mode: z.enum(["sample", "public"]).default("sample"),
  consent: z.boolean().default(false),
  username: z.string().trim().max(39).default("demo-maker"),
});

export const browserStateSchema = z.object({
  version: z.literal(1), profile: profileSchema.nullable(),
  metIds: z.array(z.string().regex(/^[a-z0-9-]{1,64}$/)).max(100),
  feedback: z.record(z.enum(["worthwhile", "not-quite"])),
});

export function toViewerProfile(member: Member): ViewerProfile {
  const { name, practice, discipline, campus, bio, interests, offers, asks, visibility, openToMeet } = member;
  return { name, practice, discipline, campus: campus ?? "Los Angeles", bio, interests, offers, asks, visibility, openToMeet, projectTitle: member.project.title, projectSummary: member.project.summary, importedClaims: [], importedProject: null };
}

export function withViewerProfile(base: Member, profile?: ViewerProfile): Member {
  if (!profile) return base;
  return {
    ...base, ...profile,
    project: { ...base.project, title: profile.projectTitle, summary: profile.projectSummary, topics: profile.interests },
  };
}
