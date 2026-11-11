import type { Member, DiscoveryOptions, DiscoveryResult, DiscoveryMatch, Evidence, PublicMember, Scope } from "./types.ts";
import { concepts, parseQuery, queryEvidence, related } from "./search.ts";

function isHere(member: Member, sessionId: string): boolean {
  return member.attendance.some(a => a.sessionId === sessionId && a.status === "checked-in");
}

export function isEligible(member: Member, scope: Scope, sessionId: string): boolean {
  if (member.review !== "approved" || !member.reviewedAt || member.visibility === "private") return false;
  return scope === "community" ? member.visibility === "community" : isHere(member, sessionId);
}

function publicMember(member: Member, sessionId: string): PublicMember {
  const { id, name, practice, discipline, campus, link, bio, interests, offers, asks, project, sourceLabel, reviewedAt } = member;
  return {
    id, name, practice, discipline, campus, ...(link ? { link } : {}), bio, interests, offers, asks, project, sourceLabel, reviewedAt,
    presence: !isHere(member, sessionId) ? "away" : member.openToMeet ? "here" : "focusing",
  };
}

function pair(candidate: Member, viewer: Member) {
  const answers = candidate.offers.flatMap(offer => viewer.asks.filter(ask => related(offer, ask)).map(ask => ({ offer, ask })));
  const helps = candidate.asks.flatMap(ask => viewer.offers.filter(offer => related(offer, ask)).map(offer => ({ offer, ask })));
  const viewerTopics = concepts([...viewer.interests, ...viewer.project.topics].join(" "));
  const projectTopics = candidate.project.topics.filter(topic => concepts(topic).some(key => viewerTopics.includes(key)));
  const shared = candidate.interests.filter(interest => viewer.interests.some(v => related(interest, v)));
  const different = candidate.discipline !== viewer.discipline;
  const bridge = answers.length + helps.length + projectTopics.length + shared.length > 0;
  const score = answers.length * 30 + helps.length * 20 + projectTopics.length * (candidate.project.period === "current" ? 8 : 2) + shared.length * 4 + (different && bridge ? 5 : 0);
  const first = candidate.name.split(" ")[0];
  let reason: string, connection: string, starter: string;
  let evidence: Evidence[];
  if (answers.length) {
    const { offer, ask } = answers[0];
    connection = helps.length ? "a little give & take" : "something you’re looking for";
    const title = candidate.project.title;
    reason = `You’re looking for ${ask.toLowerCase()}. ${first} offers ${offer.toLowerCase()} and is making “${title}${/[.!?…]$/.test(title) ? "" : "."}”`;
    starter = `“I’m curious about ${offer.toLowerCase()}. Can you tell me about ${candidate.project.title}?”`;
    evidence = [{ field: "offers", excerpt: offer }, { field: "project", excerpt: candidate.project.title }];
  } else if (helps.length) {
    const { offer, ask } = helps[0];
    connection = "you could lend a hand";
    reason = `${first} is looking for ${ask.toLowerCase()}; you offer ${offer.toLowerCase()}. Start with their project, “${candidate.project.title}.”`;
    starter = `“I saw you’re looking for ${ask.toLowerCase()}. What are you hoping to try?”`;
    evidence = [{ field: "asks", excerpt: ask }, { field: "project", excerpt: candidate.project.title }];
  } else if (projectTopics.length || shared.length) {
    const topic = projectTopics[0] ?? shared[0];
    const viewerInterest = viewer.interests.find(i => related(i, topic)) ?? viewer.project.topics.find(i => related(i, topic)) ?? topic;
    connection = different ? "a different way into it" : "a shared curiosity";
    reason = `${first} is exploring ${topic.toLowerCase()} in “${candidate.project.title}.” It connects to your interest in ${viewerInterest.toLowerCase()}.`;
    starter = `“What got you interested in ${topic.toLowerCase()}?”`;
    evidence = [{ field: projectTopics.length ? "project" : "interests", excerpt: topic }];
  } else {
    connection = "another corner of Sundays";
    reason = `${first} is a ${candidate.practice} working on “${candidate.project.title}.” Their work may be a new corner of the room for you.`;
    starter = `“What are you making with ${candidate.project.title}?”`;
    evidence = [{ field: "practice", excerpt: candidate.practice }, { field: "project", excerpt: candidate.project.title }];
  }
  return { score, reason, connection, starter, evidence, differentPractice: different };
}

export function discover(members: Member[], viewer: Member, options: DiscoveryOptions): DiscoveryResult {
  const query = (options.query ?? "").trim().slice(0, 240);
  const parsed = parseQuery(query);
  const counts = {
    today: members.filter(m => m.id !== viewer.id && isEligible(m, "today", options.sessionId)).length,
    community: members.filter(m => m.id !== viewer.id && isEligible(m, "community", options.sessionId)).length,
  };
  const result: DiscoveryResult = { matches: [], counts, query, restrictedQuery: parsed.restricted, interpretation: "" };
  if (parsed.restricted) return { ...result, interpretation: "Try a creative interest, project, or something you’d like help with." };
  const surprise = options.mode === "surprise" || parsed.different;
  const hasConstraints = parsed.topics.length > 0 || parsed.terms.length > 0 || !!parsed.campus || parsed.historical;
  const searching = !!query && (!parsed.different || hasConstraints);
  const candidates = members
    .filter(m => m.id !== viewer.id && isEligible(m, options.scope, options.sessionId))
    .filter(m => searching || (m.openToMeet && !options.metIds?.includes(m.id)))
    .map(member => {
      const connection = pair(member, viewer);
      const found = searching ? queryEvidence(member, query) : null;
      if (searching && !found) return null;
      const publicProfile = publicMember(member, options.sessionId);
      const match: DiscoveryMatch = {
        member: publicProfile,
        connection: searching ? "from their own words" : connection.connection,
        reason: searching ? `${member.name.split(" ")[0]} ${found!.evidence.slice(0, 2).map(e => `${e.field === "offers" ? "offers" : e.field === "asks" ? "is looking for help with" : e.field === "interests" ? "is curious about" : "lists"} “${e.excerpt}”`).join(" and ")}${parsed.historical ? " in a project from last semester" : " in their reviewed profile"}.` : connection.reason,
        starter: searching ? `“I saw ${found!.evidence[0].field === "offers" ? "you offer" : found!.evidence[0].field === "asks" ? "you’re looking for help with" : "your note about"} ${found!.evidence[0].excerpt}. Can you tell me a little about it?”` : connection.starter,
        evidence: searching ? found!.evidence : connection.evidence,
        differentPractice: connection.differentPractice,
        metBefore: options.metIds?.includes(member.id) ?? false,
      };
      return { match, score: searching ? found!.score * 100 + connection.score : connection.score };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.score - a.score || a.match.member.id.localeCompare(b.match.member.id));

  let selected = candidates;
  if (surprise) {
    const usual = new Set(candidates.slice(0, 3).map(c => c.match.member.id));
    const different = candidates.filter(c => c.match.differentPractice && c.score > 0);
    const unexpected = different.filter(c => !usual.has(c.match.member.id));
    const pool = unexpected.length > 1 ? unexpected : different;
    const offset = pool.length ? Math.abs(Math.floor(options.seed ?? 0)) % pool.length : 0;
    selected = [...pool.slice(offset), ...pool.slice(0, offset)];
  } else if (!searching && candidates.length > 3 && !candidates.slice(0, 3).some(c => c.match.differentPractice)) {
    const cross = candidates.find(c => c.match.differentPractice && c.score > 0);
    if (cross) selected = [candidates[0], candidates[1], cross, ...candidates.slice(2).filter(c => c !== cross)];
  }
  result.matches = selected.map(c => c.match);
  result.interpretation = searching
    ? [parsed.campus, parsed.historical ? "projects from last semester" : "reviewed profiles", parsed.capability ? "offers & project experience" : "interests, offers & projects"].filter(Boolean).join(" · ")
    : surprise ? "Different practices. A real reason to connect." : "A few connections through what you’re making, offering, and curious about.";
  return result;
}
