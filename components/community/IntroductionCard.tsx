"use client";

import { ArrowUpRight } from "lucide-react";
import type { DiscoveryMatch } from "@/lib/community/types";
import { Presence, practiceObject } from "./MemberDialog";

export default function IntroductionCard({ match, onOpen }: { match: DiscoveryMatch; onOpen: () => void }) {
  const { member } = match;
  return (
    <article className={"meet-card discipline-" + member.discipline}>
      <div className="meet-fold" aria-hidden="true" />
      <div className="meet-card-top"><span className="meet-connection">{match.connection}</span><img className="meet-practice-object" src={practiceObject[member.discipline]} width={98} height={98} alt="" /></div>
      <div className="meet-card-identity"><h3>{member.name}</h3><p>{member.practice}{member.campus && <span> · {member.campus}</span>}</p></div>
      <div className="meet-card-project"><span className="meet-eyebrow">{member.project.period === "last-semester" ? "last semester’s project" : "making"}</span><p>{member.project.title}</p></div>
      <div className="meet-card-reason"><span className="meet-small-star" aria-hidden="true">⁂</span><p>{match.reason}</p></div>
      <div className="meet-card-bottom"><Presence value={member.presence} /><button className="meet-card-link" onClick={onOpen}>{match.metBefore ? "See " : "Meet "}{member.name.split(" ")[0]}<ArrowUpRight size={18} aria-hidden="true" /></button></div>
    </article>
  );
}
