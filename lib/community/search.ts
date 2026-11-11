import type { Campus, Evidence, Member } from "./types.ts";

export function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const aliases: Record<string, string[]> = {
  film: ["film", "films", "filmmaking", "filmmaker", "video", "videos", "visual storytelling"],
  music: ["music", "musician", "musical"],
  "sound design": ["sound design", "sound", "audio", "field recording"],
  "motion design": ["motion design", "motion graphics"],
  "creative coding": ["creative coding", "creative code", "creative technologist"],
  AI: ["ai", "artificial intelligence", "generative", "machine learning", "ai prototyping"],
  education: ["education", "educational", "teaching", "learning design"],
  hardware: ["hardware", "electronics", "arduino", "physical computing"],
  robotics: ["robotics", "robots", "robot"],
  Blender: ["blender"],
  "3D": ["3d", "3d modeling", "modelling"],
  iOS: ["ios", "swift", "iphone", "mobile development"],
  "web development": ["web development", "websites", "web apps", "react", "typescript"],
  "visual storytelling": ["visual storytelling", "storytelling"],
  "film editing": ["film editing", "video editing", "editing"],
  "interactive art": ["interactive art", "interactive", "interactive stories"],
  typography: ["typography", "type design", "fonts", "font", "typeface"],
  illustration: ["illustration", "illustrated", "drawing"],
  ceramics: ["ceramics", "ceramic", "pottery", "clay"],
  writing: ["writing", "writer", "poetry", "poet", "oral history"],
  printmaking: ["printmaking", "prints", "printmaker"],
};

function containsPhrase(text: string, phrase: string): boolean {
  return ` ${normalize(text)} `.includes(` ${normalize(phrase)} `);
}

export function concepts(text: string): string[] {
  return Object.entries(aliases).filter(([, words]) => words.some(w => containsPhrase(text, w))).map(([key]) => key);
}

export function related(a: string, b: string): boolean {
  if (normalize(a) === normalize(b)) return true;
  const keys = concepts(a);
  return keys.some(k => concepts(b).includes(k));
}

const stopWords = new Set("a an the who whose here anyone someone somebody does do is are was were has have had at in on for to with and or of me my from about making make makers working work works building built something anything interesting interested interestingly knows know can help familiar experience find people person should talk related last previous past semester today sunday sundays app completely different surprise unexpected than i want looking into could project projects their that this they as it any offers offer skilled proficient able".split(" "));

export function parseQuery(query: string) {
  const clean = normalize(query);
  const campus: Campus | undefined = /\busc\b/.test(clean) ? "USC" : /\bucla\b/.test(clean) ? "UCLA" : undefined;
  const restricted = /\b(women|woman|men|female|male|muslim|christian|jewish|gay|straight|depression|wealthy|ethnicity|gender|religion|young|democrat|republican|black|white|asian|latino|latina|race|disabled|disability|autistic)\b/.test(clean);
  const topics = concepts(query);
  const helpWanted = /\b(can|could|able to) help\b|\bhelp me\b|\b(looking|look) for help\b|\boffers?\b/.test(clean);
  const capability = helpWanted || /\b(knows?|built|experience|familiar|skilled|proficient)\b/.test(clean);
  // Remove only recognized phrases, then require every meaningful remaining term.
  // Recognizing Blender must never silently discard an additional "Houdini" constraint.
  let remainder = ` ${clean} `;
  const phrases = [...new Set(Object.values(aliases).flat())].sort((a, b) => b.length - a.length);
  for (const phrase of phrases) remainder = remainder.replaceAll(` ${normalize(phrase)} `, " ");
  const precisePhrases = capability ? ["react", "typescript", "swift", "arduino", "blender", "machine learning", "field recording", "physical computing", "generative video", "generative ai"].filter(phrase => containsPhrase(clean, phrase)) : [];
  const terms = [...new Set(remainder.split(" ").filter(t => t.length > 1 && !stopWords.has(t) && t !== "usc" && t !== "ucla"))];
  return {
    campus, topics, terms, restricted, helpWanted, precisePhrases,
    historical: /\b(last|previous|past) semester\b/.test(clean),
    capability,
    different: /\b(different|surprise|unexpected)\b/.test(clean),
  };
}

export function queryEvidence(member: Member, query: string): { score: number; evidence: Evidence[] } | null {
  const parsed = parseQuery(query);
  if (parsed.restricted || (parsed.campus && member.campus !== parsed.campus)) return null;
  if (parsed.historical && member.project.period !== "last-semester") return null;
  const fields: { field: Evidence["field"]; value: string; weight: number }[] = [
    ...member.offers.map(value => ({ field: "offers" as const, value, weight: 7 })),
    ...(!parsed.helpWanted ? [member.project.title, member.project.summary, ...member.project.topics].map(value => ({ field: "project" as const, value, weight: 5 })) : []),
    ...(!parsed.capability ? member.interests.map(value => ({ field: "interests" as const, value, weight: 3 })) : []),
    ...(!parsed.capability ? member.asks.map(value => ({ field: "asks" as const, value, weight: 2 })) : []),
    ...(!parsed.helpWanted ? [{ field: "practice" as const, value: member.practice, weight: 2 }] : []),
  ];
  let score = 0;
  const evidence: Evidence[] = [];
  const record = (found: typeof fields[number]) => {
    if (evidence.some(e => e.field === found.field && e.excerpt === found.value)) return;
    score += found.weight;
    evidence.push({ field: found.field, excerpt: found.value });
  };
  for (const phrase of parsed.precisePhrases) {
    const found = fields.find(f => containsPhrase(f.value, phrase));
    if (!found) return null;
    record(found);
  }
  if (parsed.topics.length) {
    for (const topic of parsed.topics) {
      const found = fields.find(f => concepts(f.value).includes(topic));
      if (!found) return null;
      record(found);
    }
  }
  if (parsed.terms.length) {
    const nameMatches = !parsed.topics.length && parsed.terms.every(t => normalize(member.name).split(" ").some(w => w.startsWith(t)));
    if (nameMatches) return { score: 25, evidence: [{ field: "project", excerpt: member.project.title }] };
    for (const term of parsed.terms) {
      const found = fields.find(f => normalize(f.value).split(" ").some(w => w.startsWith(term)));
      if (!found) return null;
      record(found);
    }
  } else if (!parsed.topics.length && !parsed.campus && !parsed.historical && !parsed.different) return null;
  if (!evidence.length) evidence.push({ field: "project", excerpt: member.project.title });
  return { score, evidence };
}
