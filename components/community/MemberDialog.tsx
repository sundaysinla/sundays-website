"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Copy, HeartHandshake } from "lucide-react";
import type { DiscoveryMatch, BrowserState, ViewerProfile } from "@/lib/community/types";
import MeetDialog from "./MeetDialog";

export const practiceObject: Record<string, string> = {
  film: "/maker-camera.png", music: "/maker-keyboard.png", design: "/maker-design.png",
  technology: "/maker-laptop.png", craft: "/maker-paintbrush.png", writing: "/maker-notebook.png", research: "/maker-notebook.png", general: "/maker-notebook.png",
};

export function Presence({ value }: { value: DiscoveryMatch["member"]["presence"] }) {
  return <span className={`meet-presence is-${value}`}><span aria-hidden="true" />{value === "here" ? "here & open to a hello" : value === "focusing" ? "in focus mode today" : "from another Sunday"}</span>;
}

export default function MemberDialog({ match, viewer, met, feedback, onClose, onMet, onFeedback }: {
  match: DiscoveryMatch; viewer: Pick<ViewerProfile, "name">; met?: boolean;
  feedback?: BrowserState["feedback"][string]; onClose: () => void; onMet?: () => void;
  onFeedback?: (value: BrowserState["feedback"][string]) => void;
}) {
  const { member } = match;
  const first = member.name.split(" ")[0];
  const [intro, setIntro] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const note = `${viewer.name} would like to meet ${member.name}. ${match.reason} A starting point: ${match.starter}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(note); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  };
  return (
    <MeetDialog title={member.name} description={[member.practice, member.campus].filter(Boolean).join(" · ")} onClose={onClose}>
      <div className={`meet-person-art discipline-${member.discipline}`}>
        {/* Creative objects represent a practice, never a person's photograph. */}
        <img src={practiceObject[member.discipline]} alt="" width={135} height={135} />
        <Presence value={member.presence} />
      </div>
      {member.bio && <p className="meet-profile-bio">{member.bio}</p>}
      <div className="meet-profile-project">
        <span className="meet-eyebrow">{member.project.period === "last-semester" ? "a project from last semester" : "on their worktable"}</span>
        <h3>{member.project.title}<ArrowUpRight size={17} aria-hidden="true" /></h3>
        <p>{member.project.summary}</p>
        {member.link && <a className="meet-text-button" href={member.link} target="_blank" rel="noreferrer">See their work <ArrowUpRight size={14} /></a>}
      </div>
      <div className="meet-ask-offer">
        <section><span className="meet-eyebrow">can offer</span><p>{member.offers.length ? member.offers.join(" · ") : "They haven’t added an offer yet."}</p></section>
        <section><span className="meet-eyebrow">could use a hand with</span><p>{member.asks.length ? member.asks.join(" · ") : "Nothing specific right now."}</p></section>
      </div>
      <div className="meet-conversation-note">
        <span className="meet-eyebrow">a place to start</span>
        <p>{match.starter}</p>
      </div>
      <details className="meet-source-details">
        <summary>Where this connection comes from</summary>
        <p>From {member.sourceLabel} · {new Date(`${member.reviewedAt}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
        <ul>{match.evidence.map((e, i) => <li key={`${e.field}-${i}`}>{e.field}: “{e.excerpt}”</li>)}</ul>
      </details>
      {member.presence === "focusing" ? <p className="meet-quiet-note">{first} is focusing today.</p> : <>
        <div className="meet-dialog-actions">
          {member.presence === "here" && onMet && <button className="meet-button is-dark" onClick={onMet} disabled={met}>{met ? <><Check size={16} /> You said hello</> : <><HeartHandshake size={17} /> I met {first}</>}</button>}
          {member.presence === "here" && <button className="meet-button" onClick={() => setIntro(value => !value)}>Show a host an intro note</button>}
        </div>
        {intro && <section className="meet-intro-note"><span className="meet-eyebrow">a little introduction</span><p>{note}</p><button className="meet-text-button" onClick={copy}><Copy size={14} />{copied ? "Copied" : "Copy note"}</button>{copyError && <small>Copy isn’t available. Select the note above.</small>}</section>}
        {met && onFeedback && <section className="meet-feedback" aria-label="Conversation feedback"><p>Was it a good connection?</p><div><button className={`meet-chip ${feedback === "worthwhile" ? "is-selected" : ""}`} aria-pressed={feedback === "worthwhile"} onClick={() => onFeedback("worthwhile")}>Worth saying hello</button><button className={`meet-chip ${feedback === "not-quite" ? "is-selected" : ""}`} aria-pressed={feedback === "not-quite"} onClick={() => onFeedback("not-quite")}>Not quite my thing</button></div></section>}
      </>}
    </MeetDialog>
  );
}
