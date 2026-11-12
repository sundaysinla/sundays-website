import { concepts, parseQuery } from "../search.ts";
import type { Portfolio } from "./portfolio.ts";

export type Card = { name: string; project: string; portfolio: Portfolio | null };
export type Person = { id: string; card: Card };
export type CardEvidence = { text: string; url?: string };
export type PilotMatch = { person: Person; topic: string; yours: CardEvidence; theirs: CardEvidence };

const ignored = new Set(("about again also another been being build building built could creating different doing every " +
  "from getting have help here idea just kind learn learning like little look looking make making more much need " +
  "new next only other people personal portfolio project really right short site some something still study that " +
  "their them there these they thing think this those through time today trying using very want website week " +
  "what when where will with work working would your").split(" "));
const specific = new Set(["Blender", "ceramics", "creative coding", "motion design", "printmaking", "robotics", "typography"]);
const words = (text: string): string[] => text.normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").match(/[\p{L}\p{N}]+/gu) ?? [];
const singular = (word: string) => word.length >= 5 ? word.replace(/ies$/, "y").replace(/(?<![su])s$/, "") : word;

function evidence(card: Card): CardEvidence[] {
  return [...(card.project ? [{ text: card.project }] : []), ...(card.portfolio?.excerpts ?? [])];
}

type Signal = { topic: string; weight: number; excerpt: CardEvidence };
function signals(card: Card): Map<string, Signal> {
  const result = new Map<string, Signal>();
  for (const excerpt of evidence(card)) {
    const record = (topic: string, weight: number) => {
      const key = topic.toLowerCase();
      if ((result.get(key)?.weight ?? 0) < weight) result.set(key, { topic, weight, excerpt });
    };
    for (const phrase of excerpt.text.split(/[.!?,;:\u2013\u2014]+/u)) {
      const original = words(phrase);
      const tokens = original.map(singular);
      if (/\b(?:short (?:film|documentary)|documentary short)\b/.test(tokens.join(" "))) record("short films", 9);
      if (original.includes("ios")) record("iOS", 8);
      for (const topic of concepts(phrase)) {
        if (specific.has(topic)) record(topic, 8);
      }
      const meaningful = tokens.map(word => word.length >= 4 && !ignored.has(word) && /\p{L}/u.test(word));
      tokens.forEach((word, index) => {
        if (!meaningful[index] || !meaningful[index + 1]) return;
        const key = word + " " + tokens[index + 1];
        if (!result.has(key)) result.set(key, { topic: original[index] + " " + original[index + 1], weight: 7, excerpt });
      });
    }
  }
  return result;
}

function scoreMatch(person: Person, viewer: Map<string, Signal>) {
  const overlaps = [...signals(person.card)].flatMap(([key, theirs]) => {
    const yours = viewer.get(key);
    if (!yours) return [];
    const strength = Math.min(yours.weight, theirs.weight);
    const score = strength + Number(!yours.excerpt.url) + Number(!theirs.excerpt.url);
    return [{ strength, score, topic: theirs.topic, yours: yours.excerpt, theirs: theirs.excerpt }];
  }).sort((a, b) => b.strength - a.strength || b.score - a.score);
  const first = overlaps[0];
  if (!first) return [];
  const { topic, yours, theirs, score } = first;
  return [{ score, match: { person, topic, yours, theirs } }];
}

export function matchPeople(people: Person[], viewer: Card | null, query: string): { people: Person[]; matches: PilotMatch[] } {
  if (query && parseQuery(query).restricted) return { people: [], matches: [] };
  const terms = words(query);
  const visible = people.filter(person => {
    if (!query) return true;
    const searchable = words([person.card.name, ...evidence(person.card).map(item => item.text)].join(" "));
    return terms.length > 0 && terms.every(term => searchable.some(word => word.startsWith(term)));
  }).sort((a, b) => a.card.name.localeCompare(b.card.name) || a.id.localeCompare(b.id));
  if (query || !viewer) return { people: visible, matches: [] };
  const viewerSignals = signals(viewer);
  const matches = visible.flatMap(person => scoreMatch(person, viewerSignals)).sort((a, b) => b.score - a.score);
  return { people: visible, matches: matches.slice(0, 3).map(({ match }) => match) };
}
