"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, Search } from "lucide-react";
import type { Card } from "@/lib/community/pilot/intake";
import type { MemberView, PilotDiscovery } from "@/lib/community/pilot/store";
import type { DiscoveryMatch } from "@/lib/community/types";
import IntroductionCard from "../IntroductionCard";
import MemberDialog from "../MemberDialog";
import { PilotRequestError, pilotRequest } from "./client";

export default function MemberPanel() {
  const [view, setView] = useState<MemberView | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [result, setResult] = useState<PilotDiscovery | null>(null);
  const [reading, setReading] = useState(false);
  const [selected, setSelected] = useState<DiscoveryMatch | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const opening = useRef<{ request: Promise<MemberView>; hasClaim: boolean } | null>(null);
  const activeContext = useRef("");

  function receive(data: MemberView) { activeContext.current = data.context; setView(data); setCard(data.card); }

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
      setView(null); setCard(null); setResult(null); setSelected(null); setReading(false);
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
        if (error instanceof PilotRequestError && error.status === 401) { setView(null); setCard(null); setResult(null); setReading(false); }
      }
    } finally { if (activeContext.current === context) setBusy(false); }
  }

  function change<K extends keyof Card>(key: K, value: Card[K]) {
    setCard(previous => previous ? { ...previous, [key]: value } : previous);
  }

  async function introductions(term: string, openId?: string) {
    const context = activeContext.current;
    setReading(true);
    setResult(null); setSelected(null);
    try {
      const next = await pilotRequest<PilotDiscovery>("discover", { query: term, context });
      if (activeContext.current !== context) return;
      setResult(next);
      if (openId) setSelected(next.matches.find(match => match.member.id === openId) ?? null);
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
      if (refreshing) return;
      refreshing = true;
      void run(() => introductions(result.query, selected?.member.id));
    };
    const timer = window.setTimeout(refresh, Math.max(0, result.expiresAt - Date.now()));
    window.addEventListener("focus", refresh);
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", refresh); };
  }, [result, selected]);

  function share(event: FormEvent) {
    event.preventDefault();
    if (!card || !view) return;
    const { context } = view;
    void run(async () => {
      const data = await pilotRequest<MemberView>("share", { card, context });
      if (activeContext.current !== context) return;
      receive(data);
      setNotice("Card shared.");
      if (!data.discoveryMessage) { setQuery(""); await introductions(""); }
    });
  }

  return (
    <div className="meet-content pilot-content">
      <div className="pilot-heading">
        <h1>{reading ? "You should meet." : view ? "Your Sundays card." : busy ? "Opening your card…" : "Claim your Sundays card."}</h1>
        {reading && <button className="meet-text-button" disabled={busy} onClick={() => { setReading(false); setResult(null); setSelected(null); setError(""); }}>Your card</button>}
      </div>
      {error && <p role="alert" className="meet-error-text">{error}</p>}
      {notice && <p role="status" className="meet-inline-success"><Check size={16} />{notice}</p>}
      {!view || !card ? (
        !busy && !notice && !error ? <p>Ask a host for your personal claim link.</p> : null
      ) : reading ? <>
        <div className="pilot-section-heading"><h2 id="meet-results-title" tabIndex={-1}>Here today</h2>{result && <span className="pilot-meta">{result.counts.today} {result.counts.today === 1 ? "person" : "people"}</span>}</div>
        <form className="meet-search-form pilot-search" onSubmit={event => { event.preventDefault(); void run(() => introductions(query)); }}>
          <Search size={18} aria-hidden="true" />
          <label className="sr-only" htmlFor="pilot-search">Search people or projects</label>
          <input id="pilot-search" type="search" placeholder="Who are you curious about?" maxLength={240} value={query} onChange={event => setQuery(event.target.value)} />
          <button className="meet-search-submit" disabled={busy}>Find someone <ArrowRight size={16} aria-hidden="true" /></button>
        </form>
        {!result ? <p role="status" className="pilot-meta">Finding connections…</p> : result.matches.length ? <div className="meet-cards">{result.matches.map(match => <IntroductionCard key={match.member.id} match={match} onOpen={() => void run(() => introductions(result.query, match.member.id))} />)}</div> :
          <div className="meet-empty"><h3>{result.query ? "No matches yet." : "No introductions yet."}</h3><p>{result.query ? "Try a project or interest." : "Shared cards appear after people check in."}</p></div>}
        {selected && <MemberDialog match={selected} viewer={card} onClose={() => setSelected(null)} />}
      </> : (
        <section className="pilot-panel pilot-editor" aria-label="Your card">
          <p className="pilot-meta">{view.event.name} · {view.shared ? "Shared today" : "Private card"}</p>
          <form className="meet-profile-form" onSubmit={share}>
            <label>Your name<input required maxLength={80} value={card.name} onChange={e => change("name", e.target.value)} /></label>
            <label>What are you working on?<textarea required rows={3} maxLength={300} value={card.project} onChange={e => change("project", e.target.value)} /></label>
            <details className="pilot-details" open={!!card.ask || !!card.link || undefined}>
              <summary>Ask, offer, or link</summary>
              <div className="meet-editor-grid">
                <label>Could use a hand with<input maxLength={60} value={card.ask} onChange={e => change("ask", e.target.value)} /></label>
                <label>Can offer<input maxLength={60} value={card.offer} onChange={e => change("offer", e.target.value)} /></label>
              </div>
              <label>Project link<input type="url" maxLength={400} value={card.link} onChange={e => change("link", e.target.value)} /></label>
              {card.link && <label className="meet-checkbox-label"><input type="checkbox" checked={card.shareLink} onChange={e => change("shareLink", e.target.checked)} /> Show this link on my card</label>}
            </details>
            <div className="pilot-actions">
              <button className="meet-button is-dark" disabled={busy}>{view.shared ? "Save and share" : "Share today"} <Check size={16} /></button>
              {!view.discoveryMessage && <button type="button" className="meet-button" disabled={busy} onClick={() => void run(async () => { setQuery(""); await introductions(""); })}>See who’s here <ArrowRight size={16} /></button>}
              {view.shared && <button type="button" className="meet-text-button" disabled={busy} onClick={() => void run(async () => {
                const data = await pilotRequest<MemberView>("hide", { context: view.context });
                if (activeContext.current === view.context) { receive(data); setNotice("Card is private."); }
              })}>Keep private</button>}
            </div>
          </form>
          {view.discoveryMessage && <p className="pilot-meta" role="status">{view.discoveryMessage} <button className="meet-text-button" disabled={busy} onClick={() => void run(async () => {
            const current = await pilotRequest<MemberView>("card");
            if (current.context !== view.context) throw new PilotRequestError("This tab’s claim session changed. Open your own card again.", 401);
            setView(current);
          })}>Refresh</button></p>}
          <div className="pilot-remove">
            {confirmRemoval ? <><p>Remove your card for this Sunday?</p><div className="pilot-actions">
              <button className="meet-button" disabled={busy} onClick={() => void run(async () => {
                await pilotRequest("withdraw", { context: view.context });
                if (activeContext.current === view.context) { setView(null); setCard(null); setNotice("Your card was removed."); }
              })}>Remove card</button>
              <button className="meet-text-button" onClick={() => setConfirmRemoval(false)}>Cancel</button>
            </div></> : <button className="meet-text-button" disabled={busy} onClick={() => setConfirmRemoval(true)}>Remove my card</button>}
          </div>
        </section>
      )}
    </div>
  );
}
