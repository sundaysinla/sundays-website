"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Loader2, Pencil, Search, Shuffle, X } from "lucide-react";
import type { BrowserState, DiscoveryMatch, DiscoveryResult, Scope, ViewerProfile } from "@/lib/community/types";
import { clearBrowserState, readBrowserState, saveBrowserState } from "@/lib/community/browser-state";
import MemberDialog from "./MemberDialog";
import IntroductionCard from "./IntroductionCard";
import ProfileEditor from "./ProfileEditor";

const examples = ["Who here knows Blender?", "Someone to make a music video with", "Education & artificial intelligence", "Who knows motion design?"];

export default function DiscoveryExperience({ initialViewer, initialResult, liveImportEnabled }: {
  initialViewer: ViewerProfile; initialResult: DiscoveryResult; liveImportEnabled: boolean;
}) {
  const [storedProfile, setStoredProfile] = useState<ViewerProfile | null>(null);
  const profile = storedProfile ?? initialViewer;
  const [hydrated, setHydrated] = useState(false);
  const [metIds, setMetIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<BrowserState["feedback"]>({});
  const [scope, setScope] = useState<Scope>("today");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"recommended" | "surprise">("recommended");
  const [seed, setSeed] = useState(0);
  const [result, setResult] = useState(initialResult);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<DiscoveryMatch | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = readBrowserState(window.localStorage);
      if (saved.state) { setStoredProfile(saved.state.profile); setMetIds(saved.state.metIds); setFeedback(saved.state.feedback); }
      if (saved.recovered) setNotice("Your saved changes couldn’t be restored. Edit your profile to start again.");
    } catch { setNotice("Changes will last for this visit."); }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const empty = !storedProfile && !metIds.length && !Object.keys(feedback).length;
      const success = empty ? clearBrowserState(window.localStorage) : saveBrowserState(window.localStorage, { version: 1, profile: storedProfile, metIds, feedback });
      if (!success) setNotice("Changes couldn’t be saved. They’ll last for this visit.");
    } catch { setNotice("Changes couldn’t be saved. They’ll last for this visit."); }
  }, [hydrated, storedProfile, metIds, feedback]);

  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    setPending(true); setError("");
    void (async () => {
      try {
        const response = await fetch("/api/community/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, scope, query, mode, seed, metIds }), signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "We couldn’t find the room. Try again.");
        if (!controller.signal.aborted) setResult(data);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "The search was interrupted. Try again."); }
      finally { if (!controller.signal.aborted) setPending(false); }
    })();
    return () => controller.abort();
  }, [hydrated, profile, scope, query, mode, seed, metIds, retry]);

  const search = (value: string) => { setInput(value); setQuery(value.trim()); setMode("recommended"); setExpanded(false); setRetry(r => r + 1); };
  const submit = (event: FormEvent) => { event.preventDefault(); search(input); };
  const surprise = () => { setInput(""); setQuery(""); setMode("surprise"); setSeed(s => (s + 1) % 1_000_000); setExpanded(false); };
  const reset = () => {
    try { clearBrowserState(window.localStorage); } catch { /* Visit-only state still resets. */ }
    setStoredProfile(null); setMetIds([]); setFeedback({}); setEditOpen(false);
    setNotice("Profile reset.");
  };
  const visibleMatches = query || expanded ? result.matches : result.matches.slice(0, 3);
  const showEmpty = !pending && !error && result.matches.length === 0;
  const firstName = profile.name.split(" ")[0];
  return (
    <main className="meet-surface meet-page">
      <a className="meet-skip-link" href="#meet-results">Skip to people</a>
      <header className="meet-header">
        <Link className="meet-brand" href="/" aria-label="Sundays home"><img src="/smiley.png" width={32} height={32} alt="" /><span>SUNDAYS IN LA</span></Link>
        <nav aria-label="Sundays"><Link href="/#about">About</Link><Link href="/#projects">Projects</Link><Link href="/meet" aria-current="page">You should meet <span aria-hidden="true">↗</span></Link></nav>
        <button className="meet-profile-toggle" onClick={() => setEditOpen(true)}><span className="meet-avatar" aria-hidden="true">{firstName[0]}</span><span>Your profile</span><Pencil size={13} aria-hidden="true" /></button>
      </header>

      <div className="meet-content">
        <section className="meet-hero" aria-labelledby="meet-title">
          <div className="meet-hero-copy"><h1 id="meet-title">you should <span className="meet-title-word"><em>meet.</em><svg viewBox="0 0 190 12" aria-hidden="true"><path d="M2 8Q70 0 186 7M10 11Q100 4 180 10" /></svg></span></h1><p className="meet-hero-description">Someone here is making something<br className="meet-desktop-break" /> you’d love to hear about.</p></div>
          <aside className="meet-your-note" aria-label="Your project"><span className="meet-note-pin" aria-hidden="true" /><div className="meet-note-top"><span className="meet-eyebrow">{firstName}’s Sunday</span><button className="meet-text-button" onClick={() => setEditOpen(true)} aria-label="Edit your Sunday profile"><Pencil size={14} /></button></div><p>“{profile.projectSummary}”</p><span className="meet-note-foot">{profile.visibility === "private" ? "your profile is private" : !profile.openToMeet ? "a little focus time" : "open to a good conversation"}<span aria-hidden="true">☺</span></span></aside>
        </section>

        {notice && <div className="meet-notice" role="status"><Check size={15} /><p>{notice}</p><button className="meet-icon-button" aria-label="Dismiss notice" onClick={() => setNotice("")}><X size={15} /></button></div>}

        <section className="meet-discovery-controls" aria-label="Find your people">
          <div className="meet-scope-row"><div className="meet-scope-picker" role="group" aria-label="Discovery scope"><button aria-pressed={scope === "today"} className={scope === "today" ? "is-active" : ""} onClick={() => { setScope("today"); setExpanded(false); }}>Here today <span>{result.counts.today}</span></button><button aria-pressed={scope === "community"} className={scope === "community" ? "is-active" : ""} onClick={() => { setScope("community"); setExpanded(false); }}>Sundays community <span>{result.counts.community}</span></button></div></div>
          <form className="meet-search-form" onSubmit={submit}><Search size={20} strokeWidth={1.5} aria-hidden="true" /><label className="sr-only" htmlFor="meet-search">Search people, interests, or projects</label><input id="meet-search" type="search" maxLength={240} value={input} onChange={e => setInput(e.target.value)} placeholder="Who are you curious about?" autoComplete="off" /><button className="meet-search-submit" type="submit">Find someone<ArrowRight size={17} aria-hidden="true" /></button></form>
          <div className="meet-examples">{examples.map(example => <button key={example} className="meet-example" onClick={() => search(example)}>{example}<ArrowUpRight size={12} aria-hidden="true" /></button>)}</div>
        </section>

        <section id="meet-results" className="meet-results" aria-busy={pending}>
          <div className="meet-results-heading"><div><h2 id="meet-results-title" tabIndex={-1}>{query ? <>People for <em>“{query}”</em></> : mode === "surprise" ? <>A pleasant <em>surprise.</em></> : <>Three people, <em>to start.</em></>}</h2></div><button className={`meet-surprise ${mode === "surprise" ? "is-active" : ""}`} onClick={surprise}><Shuffle size={16} strokeWidth={1.5} />Surprise me</button></div>
          <div className={`meet-result-description ${!query ? "is-compact" : ""}`} role="status" aria-live="polite"><span>{pending ? <><Loader2 size={13} className="meet-spin" /> Finding connections…</> : !error && query ? `${result.matches.length} ${result.matches.length === 1 ? "person" : "people"}` : null}</span>{query && <button className="meet-text-button" onClick={() => search("")}>Clear search <X size={12} /></button>}</div>
          {error ? <div className="meet-empty" role="alert"><span aria-hidden="true">↻</span><h3>A little interruption.</h3><p>{error}</p><button className="meet-button is-dark" onClick={() => setRetry(r => r + 1)}>Try again</button></div> : showEmpty ? <div className="meet-empty"><span aria-hidden="true">⁂</span><h3>{result.restrictedQuery ? "Start with a creative curiosity." : "No one in this corner just yet."}</h3><p>{result.restrictedQuery ? "Search what people make, care about, or would like help with." : scope === "today" ? "Try the wider Sundays community, or a different way of asking." : "Try a project, an interest, or something you’d like a hand with."}</p><div>{scope === "today" && !result.restrictedQuery && <button className="meet-button" onClick={() => setScope("community")}>Search the community <ArrowUpRight size={15} /></button>}<button className="meet-text-button" onClick={() => search("")}>Back to a few good hellos</button></div></div> : <div className={`meet-cards ${pending ? "is-pending" : ""}`}>{visibleMatches.map(match => <IntroductionCard key={match.member.id} match={match} onOpen={() => setSelected(match)} />)}</div>}
          {!error && !showEmpty && !query && result.matches.length > 3 && <div className="meet-more-row"><button className="meet-text-button" onClick={() => setExpanded(e => !e)}>{expanded ? "Back to three introductions" : `A few more good people (${result.matches.length - 3})`}<ArrowDown size={14} className={expanded ? "is-up" : ""} /></button></div>}
        </section>

        <footer className="meet-footer"><Link href="/">← back to Sundays</Link>{metIds.length > 0 && <span className="meet-meeting-count">{metIds.length} hello{metIds.length === 1 ? "" : "s"}</span>}<button className="meet-text-button" onClick={() => setEditOpen(true)}>Your profile & privacy <ArrowUpRight size={13} /></button></footer>
      </div>
      {selected && <MemberDialog match={selected} viewer={profile} met={metIds.includes(selected.member.id)} feedback={feedback[selected.member.id]} onClose={() => setSelected(null)} onMet={() => { setMetIds(ids => [...new Set([...ids, selected.member.id])].slice(-100)); }} onFeedback={value => setFeedback(values => ({ ...values, [selected.member.id]: value }))} />}
      {editOpen && <ProfileEditor initial={profile} liveImportEnabled={liveImportEnabled} onClose={() => setEditOpen(false)} onSave={value => { setStoredProfile(value); setEditOpen(false); setNotice("Profile saved."); }} onReset={reset} />}
    </main>
  );
}
