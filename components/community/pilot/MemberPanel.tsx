"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, Search } from "lucide-react";
import type { CardEvidence, Person, PilotMatch } from "@/lib/community/pilot/matching";
import type { Portfolio } from "@/lib/community/pilot/portfolio";
import type { MemberView, PilotDiscovery } from "@/lib/community/pilot/store";
import MeetDialog from "../MeetDialog";
import { PilotRequestError, pilotRequest } from "./client";

function PortfolioLink({ url, label = "Portfolio" }: { url: string; label?: string }) {
  return <a className="meet-text-button" href={url} target="_blank" rel="noreferrer">{label} <ArrowUpRight size={14} aria-hidden="true" /></a>;
}

function PortfolioPreview({ portfolio }: { portfolio: Portfolio }) {
  return <div className="pilot-portfolio">
    <PortfolioLink url={portfolio.url} />
    {portfolio.excerpts.map(({ url, text }) => <blockquote key={url}>
      <p>{text}</p>
      {url !== portfolio.url && <PortfolioLink url={url} label="Source page" />}
    </blockquote>)}
  </div>;
}

function MatchEvidence({ item, label }: { item: CardEvidence; label: string }) {
  return <li><span className="meet-eyebrow">{label}</span><p>{item.text}</p>
    {item.url && <PortfolioLink url={item.url} label="Source page" />}
  </li>;
}

function Intro({ person, match, viewer, onClose }: { person: Person; match?: PilotMatch; viewer: string; onClose: () => void }) {
  const { card } = person;
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "unavailable">("idle");
  const note = `${viewer} would like to meet ${card.name}.${match ? ` A starting point is ${match.topic}.` : ""}`;
  return <MeetDialog title={card.name} description="Here today" onClose={onClose}>
    {card.project && <div className="meet-profile-project">
      <span className="meet-eyebrow">What they’re working on</span><p>{card.project}</p>
    </div>}
    {card.portfolio && <PortfolioLink url={card.portfolio.url} />}
    {match && <div className="meet-conversation-note">
      <span className="meet-eyebrow">A place to start</span>
      <p>Ask {card.name.split(" ")[0]} about {match.topic}.</p>
      <details className="meet-source-details">
        <summary>Why you two</summary>
        <ul className="pilot-evidence">
          <MatchEvidence item={match.yours} label={match.yours.url ? "Your portfolio" : "Your RSVP"} />
          <MatchEvidence item={match.theirs} label={match.theirs.url ? "Their portfolio" : "Their RSVP"} />
        </ul>
      </details>
    </div>}
    <details className="meet-source-details">
      <summary>Show a host</summary>
      <p>{note}</p>
      <button className="meet-text-button" onClick={async () => {
        try { await navigator.clipboard.writeText(note); setCopyStatus("copied"); }
        catch { setCopyStatus("unavailable"); }
      }}>{copyStatus === "copied" ? "Copied" : "Copy note"}</button>
      {copyStatus === "unavailable" && <p role="status">Select the note to copy it.</p>}
    </details>
  </MeetDialog>;
}

export default function MemberPanel() {
  const [view, setView] = useState<MemberView | null>(null);
  const [includePortfolio, setIncludePortfolio] = useState(false);
  const [result, setResult] = useState<PilotDiscovery | null>(null);
  const [reading, setReading] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [limit, setLimit] = useState(12);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const opening = useRef<{ request: Promise<MemberView>; hasClaim: boolean } | null>(null);
  const activeContext = useRef("");

  function receive(data: MemberView) {
    activeContext.current = data.context;
    setView(data);
    setIncludePortfolio(data.includePortfolio);
  }

  useEffect(() => {
    let mounted = true;
    function open() {
      const token = window.location.hash.slice(1);
      if (token) window.history.replaceState(window.history.state, "", window.location.pathname);
      if (token || !opening.current) {
        // Serialize claim requests so the final cookie and the displayed card belong together.
        const previous = opening.current?.request.catch(() => undefined) ?? Promise.resolve();
        opening.current = { request: previous.then(() => pilotRequest<MemberView>(token ? "claim" : "card", token ? { token } : {})), hasClaim: !!token };
      }
      const current = opening.current;
      const latest = () => mounted && opening.current === current;
      activeContext.current = "";
      setView(null); setResult(null); setSelectedId(""); setReading(false); setLimit(12);
      setConfirmRemoval(false); setBusy(true); setError(""); setNotice(""); setQuery("");
      void current.request.then(data => { if (latest()) receive(data); }).catch(error => {
        if (latest() && (current.hasClaim || !(error instanceof PilotRequestError) || error.status !== 401)) setError(error.message);
      }).finally(() => { if (latest()) setBusy(false); });
    }
    const onHashChange = () => { if (window.location.hash) open(); };
    open();
    window.addEventListener("hashchange", onHashChange);
    return () => { mounted = false; window.removeEventListener("hashchange", onHashChange); };
  }, []);

  async function run(operation: () => Promise<void>) {
    const context = activeContext.current;
    setBusy(true); setError(""); setNotice("");
    try { await operation(); }
    catch (error) {
      if (activeContext.current === context) {
        setError(error instanceof Error ? error.message : "Couldn’t complete that action.");
        if (error instanceof PilotRequestError && error.status === 401) { setView(null); setResult(null); setReading(false); }
      }
    } finally { if (activeContext.current === context) setBusy(false); }
  }

  async function refreshCard(context: string) {
    const current = await pilotRequest<MemberView>("card");
    if (activeContext.current !== context) return;
    if (current.context !== context) throw new PilotRequestError("This tab’s claim session changed. Open your own card again.", 401);
    receive(current);
  }

  async function introductions(term: string, openId?: string) {
    const context = activeContext.current;
    setReading(true);
    setResult(null); setSelectedId("");
    try {
      const next = await pilotRequest<PilotDiscovery>("discover", { query: term, context });
      if (activeContext.current !== context) return;
      setResult(next);
      if (openId && next.people.some(person => person.id === openId)) setSelectedId(openId);
    } catch (error) {
      if (activeContext.current !== context) return;
      setReading(false);
      throw error;
    }
  }

  useEffect(() => {
    if (!result) return;
    let refreshing = false;
    const refresh = () => {
      if (refreshing || busy) return;
      refreshing = true;
      void run(() => introductions(result.query, selectedId));
    };
    const timer = window.setTimeout(refresh, Math.max(0, result.expiresAt - Date.now()));
    window.addEventListener("focus", refresh);
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", refresh); };
  }, [result, selectedId, busy]);

  function share() {
    if (!view?.revision) return;
    const { context, revision } = view;
    void run(async () => {
      const data = await pilotRequest<MemberView>("share", { context, revision, includePortfolio }).catch(async error => {
        if (error instanceof PilotRequestError && error.status === 409) await refreshCard(context);
        throw error;
      });
      if (activeContext.current !== context) return;
      receive(data);
      setNotice("Card shared.");
      if (!data.discoveryMessage) { setQuery(""); await introductions(""); }
    });
  }

  const selected = result?.people.find(person => person.id === selectedId);
  const card = view?.card;

  return (
    <div className="meet-content pilot-content">
      <div className="pilot-heading">
        <h1>{reading ? "Here today." : view ? "Your Sundays card." : busy ? "Opening your card…" : "Claim your Sundays card."}</h1>
        {reading && view && <button className="meet-text-button" disabled={busy} onClick={() => void run(async () => {
          setReading(false); setResult(null); setSelectedId("");
          await refreshCard(view.context);
        })}>Your card</button>}
      </div>
      {error && <p role="alert" className="meet-error-text">{error}</p>}
      {notice && <p role="status" className="meet-inline-success"><Check size={16} />{notice}</p>}
      {!view ? (
        !busy && !notice && !error ? <p>Ask a host for your personal claim link.</p> : null
      ) : reading ? <>
        <form className="meet-search-form pilot-search" onSubmit={event => {
          event.preventDefault(); setLimit(12); void run(() => introductions(query.trim()));
        }}>
          <Search size={18} aria-hidden="true" />
          <label className="sr-only" htmlFor="pilot-search">Search people or projects</label>
          <input id="pilot-search" type="search" placeholder="Search people or projects" maxLength={240} value={query} onChange={event => setQuery(event.target.value)} />
          <button className="meet-search-submit" disabled={busy}>Search <ArrowRight size={16} aria-hidden="true" /></button>
        </form>
        {!result ? <p role="status" className="pilot-meta">Finding connections…</p> : <>
          {result.matches.length > 0 && <section className="pilot-suggestions" aria-labelledby="pilot-suggestions-title">
            <h2 id="pilot-suggestions-title">You should meet.</h2>
            <div className="meet-cards">{result.matches.map(({ person, topic }) => <article className="meet-card pilot-match-card" key={person.id}>
              <span className="meet-connection">{topic}</span>
              <h3>{person.card.name}</h3>
              {person.card.project && <p>{person.card.project}</p>}
              <button className="meet-card-link" disabled={busy} onClick={() => void run(() => introductions(result.query, person.id))}>
                Meet {person.card.name.split(" ")[0]} <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            </article>)}</div>
          </section>}
          <section className="pilot-panel" aria-labelledby="meet-results-title">
            <div className="pilot-section-heading"><h2 id="meet-results-title" tabIndex={-1}>{result.query ? "Search results" : "People"}</h2>
              <span className="pilot-meta">{result.people.length}</span></div>
            {result.people.length ? <ul className="pilot-guests">{result.people.slice(0, limit).map(person => <li key={person.id}>
              <button className="pilot-person" disabled={busy} onClick={() => void run(() => introductions(result.query, person.id))}>
                <span><strong>{person.card.name}</strong>{person.card.project && <span>{person.card.project}</span>}</span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            </li>)}</ul> : <p>{result.query ? "No people found." : "Shared cards appear as people check in."}</p>}
            {result.people.length > limit && <button className="meet-text-button pilot-more" onClick={() => setLimit(limit + 12)}>Show more</button>}
          </section>
        </>}
        {selected && <Intro person={selected} match={result?.matches.find(match => match.person.id === selectedId)} viewer={view.name} onClose={() => setSelectedId("")} />}
      </> : (
        <section className="pilot-panel pilot-editor" aria-label="Your card">
          <p className="pilot-meta">{view.event.name} · {view.shared ? "Shared today" : "Private card"}</p>
          <h2>{view.name}</h2>
          {!card ? <p>Preview your Luma project answer and any public portfolio you linked.</p> : <>
            {card.project && <p className="pilot-project">{card.project}</p>}
            {view.portfolioUnavailable && <p className="pilot-meta">Portfolio unavailable. You can share your project answer.</p>}
            {card.portfolio && <>
              <PortfolioPreview portfolio={card.portfolio} />
              <label className="meet-checkbox-label pilot-portfolio-toggle"><input type="checkbox" checked={includePortfolio} disabled={busy} onChange={e => setIncludePortfolio(e.target.checked)} /> Include my portfolio</label>
            </>}
          </>}
          <div className="pilot-actions">
            {!card && <button className="meet-button is-dark" disabled={busy} onClick={() => void run(async () => {
              const data = await pilotRequest<MemberView>("prepare", { context: view.context });
              if (activeContext.current === view.context) receive(data);
            })}>{busy ? "Preparing…" : "Preview my card"} <ArrowRight size={16} aria-hidden="true" /></button>}
            {card && (!view.shared || includePortfolio !== view.includePortfolio) && <button className="meet-button is-dark" disabled={busy} onClick={share}>
              {view.shared ? "Update sharing" : "Share today"} <Check size={16} aria-hidden="true" />
            </button>}
            {!view.discoveryMessage && <button className="meet-button" disabled={busy} onClick={() => void run(async () => {
              setQuery(""); setLimit(12); await introductions("");
            })}>See who’s here <ArrowRight size={16} aria-hidden="true" /></button>}
            {view.shared && <button className="meet-text-button" disabled={busy} onClick={() => void run(async () => {
              const data = await pilotRequest<MemberView>("hide", { context: view.context });
              if (activeContext.current === view.context) { receive(data); setNotice("Your card is private."); }
            })}>Make private</button>}
          </div>
          {view.discoveryMessage && <p className="pilot-meta" role="status">{view.discoveryMessage} <button className="meet-text-button" disabled={busy} onClick={() => void run(async () => {
            await refreshCard(view.context);
          })}>Refresh</button></p>}
          <div className="pilot-remove">
            {confirmRemoval ? <><p>Remove your card for this Sunday?</p><div className="pilot-actions">
              <button className="meet-button" disabled={busy} onClick={() => void run(async () => {
                await pilotRequest("withdraw", { context: view.context });
                if (activeContext.current === view.context) { setView(null); setNotice("Your card was removed."); }
              })}>Remove card</button>
              <button className="meet-text-button" onClick={() => setConfirmRemoval(false)}>Cancel</button>
            </div></> : <button className="meet-text-button" disabled={busy} onClick={() => setConfirmRemoval(true)}>Remove my card</button>}
          </div>
        </section>
      )}
    </div>
  );
}
