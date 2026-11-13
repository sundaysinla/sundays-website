import { parseQuery } from "../search.ts";
import type { Vectors } from "./local-embeddings.ts";
import type { Portfolio } from "./portfolio.ts";

export type Card = { name: string; project: string; portfolio: Portfolio | null };
export type Person = { id: string; card: Card };
export type CardEvidence = { text: string; url?: string };
export type PilotMatch = { person: Person; topic: string | null; yours: CardEvidence; theirs: CardEvidence };
export type PilotMatcher = (people: Person[], viewer: Card | null, query: string) => { people: Person[]; matches: PilotMatch[] };

const topics: { label: string; pattern: RegExp; tool?: true }[] = [
  { label: "short films", pattern: /\b(?:short films?|short documentar(?:y|ies)|documentary shorts?)\b/ },
  { label: "documentary film", pattern: /\b(?:documentar(?:y|ies)|nonfiction films?|non fiction films?)\b(?! (?:style|themed|inspired|like))/ },
  { label: "production sound", pattern: /\b(?:production sound|boom mic|(?:record|recording|mix|mixing|edit|editing) dialog(?:ue)?|location sound)\b/ },
  { label: "field recordings", pattern: /\bfield recordings?\b/ },
  { label: "live captions", pattern: /\b(?:open captions?|live captions?|surtitles?)\b/ },
  { label: "ceramics", pattern: /\b(?:ceramics|pottery|porcelain|ceramic (?:cups?|mugs?|bowls?|vases?|planters?|vessels?|glazes?)|clay (?:mugs?|cups?|vessels?|vases?)|(?:clay|kiln) glazes?|slip cast(?:ing)?)\b(?! (?:shader|texture|material node))/ },
  { label: "screen printing", pattern: /\b(?:screen print(?:s|ing|ed)?|screenprint(?:s|ing|ed)?|silkscreen(?:s|ing|ed)?)\b/ },
  { label: "risograph printing", pattern: /\brisograph\b/ },
  { label: "letterpress", pattern: /\b(?:letterpress|movable type|relief press)\b/ },
  { label: "motion design", pattern: /\bmotion (?:design|graphics)\b/ },
  { label: "creative coding", pattern: /\bcreative cod(?:e|ing)\b/ },
  { label: "robotics", pattern: /\brobotics\b/ },
  { label: "iOS", pattern: /\bios\b|\biphone apps?\b|\b(?:app|sampler|software|developing|coding)\b.{0,40}\biphone\b|\bapp\b.{0,40}\bswiftui\b/ },
  { label: "SwiftUI", pattern: /\bswiftui\b/, tool: true },
  { label: "Blender", pattern: /\bblender\b/, tool: true },
  { label: "Arduino", pattern: /\barduino\b/, tool: true },
  { label: "Figma", pattern: /\bfigma\b/, tool: true },
  { label: "TypeScript", pattern: /\btypescript\b/, tool: true },
];
const generic = new Set(("about after again all also and another any anyone are being before both build building built can could " +
  "create creating creative currently design designing develop developing did different digital do doing during each every " +
  "find for from get getting give going got had has have having help here how idea ideas interactive into interested just " +
  "kind learn learning like little look looking made make making might more much need new next nice only other our out " +
  "over people personal plan please portfolio project projects prototype prototyping real really right same should site " +
  "some someone something still stuff such take than that the their them then there these they thing things think this " +
  "those through time today trying use used using very want was way ways website websites web app apps week were what " +
  "when where which while who why will with work working would you your ai demo generative").split(" "));
const questionWords = new Set("a an the who whose anyone anybody someone somebody people person here today is are was were has have does do know knows can could help me find looking for with works work working on making about interested in".split(" "));
const needsHelp = /\b(?:looking|searching) for (?:someone|somebody|help|a collaborator)|\bneed (?:help|someone|a way)|\bcan someone\b/i;
const negated = /\b(?:not|never|no longer) (?:working|doing|using|making|building|designing|interested|scoring|looking|a |an )|\b(?:do not|don['’]t|doesn['’]t) (?:do|work|use|make|want|know)|^no\s/i;
const passive = /^(?:(?:i['’]m|we['’]re|i am|we are)\s+)?(?:watching|browsing|shopping for)\b/i;
const projectOpening = /^(?:(?:i['’]m|we['’]re|i am|we are)\s+)?(?:(?:currently\s+)?working on|(?:building|making|creating|designing|writing) (?:an? )?(?:website for|(?:browser|chrome|firefox|safari|edge) (?:extension|add[- ]on|plugin) (?:to|for|that)))\s+/i;
const sensitive = /\b(?:woman|women|men|male|female|muslim|christian|jewish|gay|lesbian|bisexual|straight|transgender|depression|ethnicity|gender|religion|young|wealthy|democrat|republican|black|white|asian|latino|latina|race|disabled|disability|autistic)\b/gi;

const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
const words = (text: string): string[] => text.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").match(/[\p{L}\p{N}]+/gu) ?? [];
const singular = (word: string) => word.length >= 5 ? word.replace(/ies$/, "y").replace(/(?<![su])s$/, "") : word;

function evidence(card: Card): CardEvidence[] {
  return [...(card.project ? [{ text: card.project }] : []), ...(card.portfolio?.excerpts ?? [])];
}

function passages(card: Card) {
  return evidence(card).flatMap(source => {
    const sentences = [...segmenter.segment(source.text)].flatMap(({ segment }) =>
      segment.split(/;|\s+[–—]\s+|,?\s+\bbut\s+|,\s+(?=(?:I\b|I['’]m\b|we\b|my\b))/i),
    );
    return sentences.slice(0, source.url ? 3 : 6).flatMap(sentence => {
      const text = sentence.trim();
      if (negated.test(text) || passive.test(text)) return [];
      const input = text.replace(projectOpening, "").replace(sensitive, " ").replace(/\s+/g, " ").trim();
      const tokens = words(input);
      const useful = new Set(tokens.map(singular).filter(word => word.length >= 3 && /\p{L}/u.test(word) && !generic.has(word)));
      const normalized = words(text.replace(sensitive, " ")).join(" ");
      const recognized = topics.filter(({ pattern }) => pattern.test(normalized));
      return useful.size || recognized.length ? [{
        evidence: { ...source, text }, input, useful, topics: recognized, needsHelp: needsHelp.test(text),
      }] : [];
    });
  });
}

export function matchingTexts(people: Person[], viewer: Card) {
  return [...new Set([viewer, ...people.map(person => person.card)].flatMap(card =>
    passages(card).filter(passage => passage.useful.size >= 2).map(passage => passage.input),
  ))];
}

type Passage = ReturnType<typeof passages>[number];

function cosine(left?: Float32Array, right?: Float32Array) {
  if (!left || !right || left.length !== right.length) return 0;
  let score = 0;
  for (let i = 0; i < left.length; i++) score += left[i] * right[i];
  return score;
}

function connection(yours: Passage, theirs: Passage, vectors?: Vectors) {
  if (yours.needsHelp && theirs.needsHelp) return null;
  const semantic = cosine(vectors?.get(yours.input), vectors?.get(theirs.input));
  const sharedTopics = yours.topics.filter(topic => theirs.topics.includes(topic));
  const direct = sharedTopics.find(topic => !topic.tool);
  const common = [...yours.useful].filter(word => theirs.useful.has(word));
  const tool = sharedTopics.find(topic => topic.tool);
  const supportingWords = common.filter(word => !sharedTopics.some(topic => topic.tool && topic.label.toLowerCase() === word));
  const groundedTool = tool && (semantic >= .5 || supportingWords.length >= 2);
  const minWords = Math.min(yours.useful.size, theirs.useful.size);
  const lexical = supportingWords.length >= 3 && supportingWords.length >= minWords * .6;
  const close = semantic >= .48 || (semantic >= .42 && supportingWords.length >= 2);
  if (!direct && !groundedTool && !lexical && !close) return null;
  const confidence = Math.max(direct ? .69 : 0, groundedTool ? .55 : 0, lexical ? .53 : 0, semantic);
  const score = confidence + Math.max(semantic, 0) * .12 +
    Math.min(supportingWords.length, 3) * .014 + Number(!yours.evidence.url) * .035 + Number(!theirs.evidence.url) * .035;
  return { score, topic: direct?.label ?? (groundedTool ? tool.label : null), yours: yours.evidence, theirs: theirs.evidence };
}

function scoreMatch(person: Person, viewer: Passage[], vectors?: Vectors) {
  let best: ReturnType<typeof connection> = null;
  for (const theirs of passages(person.card)) {
    for (const yours of viewer) {
      const pair = connection(yours, theirs, vectors);
      if (pair && (!best || pair.score > best.score)) best = pair;
    }
  }
  if (!best) return [];
  const { score, ...reason } = best;
  return [{ score, match: { person, ...reason } }];
}

export function matchPeople(people: Person[], viewer: Card | null, query: string, vectors?: Vectors): ReturnType<PilotMatcher> {
  const restricted = !!query && parseQuery(query).restricted;
  const nameTerms = words(query);
  const terms = words(query.replace(/\bwho['’]s\b/gi, "who")).filter(term => !questionWords.has(term));
  const ordered = [...people].sort((a, b) => a.card.name.localeCompare(b.card.name) || a.id.localeCompare(b.id));
  const visible = ordered.filter(person => {
    if (restricted) return false;
    if (!query) return true;
    const name = words(person.card.name);
    if (nameTerms.length && nameTerms.every(term => name.some(word => word.startsWith(term)))) return true;
    const searchable = words(evidence(person.card).map(item => item.text).join(" "));
    return terms.length > 0 && terms.every(term => searchable.some(word => word.startsWith(term)));
  });
  if (!viewer) return { people: visible, matches: [] };
  const viewerPassages = passages(viewer);
  const matches = ordered.flatMap(person => scoreMatch(person, viewerPassages, vectors)).sort((a, b) => b.score - a.score);
  // Avoid filling the remaining slots with borderline suggestions when the evidence is much weaker.
  const floor = (matches[0]?.score ?? 0) - .17;
  return { people: visible, matches: matches.filter(({ score }) => score >= floor).slice(0, 3).map(({ match }) => match) };
}
