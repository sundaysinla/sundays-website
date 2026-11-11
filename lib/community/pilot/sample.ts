import { CONSENT_QUESTION, LINK_QUESTION, type IntakeSnapshot } from "./intake.ts";

export function sampleSnapshot(now: number): IntakeSnapshot {
  return {
    event: {
      id: "evt-SundaysSample", source: "sample", name: "Sundays at the studio",
      startAt: new Date(now - 10 * 60_000).toISOString(), endAt: new Date(now + 2 * 60 * 60_000).toISOString(),
      timezone: "America/Los_Angeles", projectQuestion: { id: "project", label: "what are you working on?" },
      consentQuestion: { id: "consent", label: CONSENT_QUESTION }, linkQuestion: { id: "link", label: LINK_QUESTION },
    },
    startedAt: now, syncedAt: now,
    guests: [
      { id: "sample-alex", attendance: "checked-in", draft: {
        name: "Alex Rivera", project: "A short film made from voice memos. I could use help with sound design.",
        ask: "sound design", offer: "", link: "", shareLink: false,
      } },
      { id: "sample-jamie", attendance: "checked-in", draft: {
        name: "Jamie Okafor", project: "A music project made of field recordings from the city.",
        ask: "", offer: "", link: "https://example.com/jamie", shareLink: false,
      } },
      { id: "sample-casey", attendance: "checked-in", draft: {
        name: "Casey Lin", project: "Building tiny 3D environments in Blender for a short film.",
        ask: "", offer: "", link: "", shareLink: false,
      } },
      { id: "sample-sam", attendance: "rsvp", draft: {
        name: "Sam Adeyemi", project: "An iOS app for saving ideas on long walks.",
        ask: "", offer: "", link: "", shareLink: false,
      } },
    ],
  };
}
