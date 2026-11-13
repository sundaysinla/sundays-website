import { createHash } from "node:crypto";
import { LINK_QUESTION, type IntakeGuest, type IntakeSnapshot } from "./intake.ts";
import type { Portfolio } from "./portfolio.ts";
import { matchPeople } from "./matching.ts";
import type { PilotDiscovery } from "./store.ts";

const sampleLink = "https://example.com/jamie";
const people = [
  { id: "sample-alex", name: "Alex Rivera", project: "Editing a short documentary about voice memos people keep. Digitizing old family videos to preserve them.", link: "", here: true },
  { id: "sample-jamie", name: "Jamie Okafor", project: "Making music from field recordings around Los Angeles.", link: sampleLink, here: true },
  { id: "sample-casey", name: "Casey Lin", project: "Building tiny sets in Blender for a short film.", link: "", here: true },
  { id: "sample-mira", name: "Mira Patel", project: "Printing a two-color risograph zine about the bus routes I grew up on.", link: "", here: true },
  { id: "sample-ines", name: "Inés Morales", project: "Making ceramic cups with glazes mixed from local clay.", link: "", here: true },
  { id: "sample-noah", name: "Noah Kim", project: "Building a tiny synthesizer with an Arduino and salvaged speakers.", link: "", here: true },
  { id: "sample-zoe", name: "Zoe Chen", project: "Restoring and archiving damaged home movies.", link: "", here: true },
  { id: "sample-sam", name: "Sam Adeyemi", project: "An iOS app for saving ideas on long walks.", link: "", here: false },
];

export function samplePortfolio(link: string): Portfolio | null {
  return link === sampleLink ? { url: link, excerpts: [{ url: link, text: "I composed scores for two short films, blending acoustic instruments with city recordings." }] } : null;
}

export function sampleSnapshot(now: number): IntakeSnapshot {
  return {
    event: {
      id: "evt-SundaysSample", source: "sample", name: "Sundays at the studio",
      startAt: new Date(now - 10 * 60_000).toISOString(), endAt: new Date(now + 2 * 60 * 60_000).toISOString(),
      timezone: "America/Los_Angeles", projectQuestion: { id: "project", label: "what are you working on?" },
      linkQuestion: { id: "link", label: LINK_QUESTION },
    },
    startedAt: now, syncedAt: now,
    guests: people.map(({ id, name, project, link, here }): IntakeGuest => ({
      id, name, attendance: here ? "checked-in" : "rsvp",
      revision: createHash("sha256").update(JSON.stringify([project, link])).digest("hex"),
      source: { kind: "sample", card: { project, link, portfolioSubmitted: !!link } },
    })),
  };
}

export function sampleDirectory(query: string, now: number, matcher = matchPeople): PilotDiscovery {
  const [viewer, ...attendees] = people.filter(person => person.here).map(({ id, name, project, link }) => ({
    id, card: { name, project, portfolio: samplePortfolio(link) },
  }));
  return { ...matcher(attendees, viewer.card, query), query, expiresAt: now + 60_000 };
}
