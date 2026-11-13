"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowRight, ArrowUpRight, CircleHelp, Link2, Search, Ticket, X } from "lucide-react";
import type { CardEvidence, Person, PilotMatch } from "@/lib/community/pilot/matching";
import type { MemberView, PilotDiscovery } from "@/lib/community/pilot/store";
import MeetDialog from "../MeetDialog";
import { PilotRequestError, pilotRequest } from "./client";

async function readTicket(file: File): Promise<string> {
  if (file.size > 15 * 1024 * 1024) throw new Error("Choose an image under 15 MB.");
  const { default: decode } = await import("jsqr");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Choose a screenshot saved as an image, or paste the QR link.");
  });
  try {
    const scale = Math.min(1, 2_048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Couldn’t read this image. Paste the QR link instead.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const ticket = decode(pixels.data, pixels.width, pixels.height);
    if (!ticket) throw new Error("Couldn’t find a QR code. Try a screenshot cropped around your ticket.");
    return ticket.data;
  } finally { bitmap.close(); }
}

function Evidence({ label, item }: { label: string; item: CardEvidence }) {
  return <figure className="room-evidence-item">
    <figcaption className="meet-eyebrow">
      {item.url ? <a href={item.url} target="_blank" rel="noreferrer">
        {label} <ArrowUpRight size={12} aria-hidden="true" />
      </a> : label}
    </figcaption>
    <blockquote>{item.text}</blockquote>
  </figure>;
}

function PersonDetail({ person, match, onClose }: { person: Person; match?: PilotMatch; onClose: () => void }) {
  const { card } = person;
  return <MeetDialog title={card.name} description={match ? `Shared topic · ${match.topic}` : card.project || "Checked in today"} onClose={onClose} className="room-dialog room-person-dialog">
    {match && card.project && card.project !== match.theirs.text && <p className="room-person-project">{card.project}</p>}
    {card.portfolio && card.portfolio.url !== match?.theirs.url && <a className="meet-text-button room-portfolio-link" href={card.portfolio.url} target="_blank" rel="noreferrer">
      Portfolio <ArrowUpRight size={14} aria-hidden="true" />
    </a>}
    {match && <section className="room-match-evidence" aria-labelledby="room-evidence-title">
      <h3 id="room-evidence-title">Why you two</h3>
      <div className="room-evidence">
        <Evidence item={match.yours} label={match.yours.url ? "Your portfolio" : "Your Luma answer"} />
        <Evidence item={match.theirs} label={match.theirs.url ? "Their portfolio" : "Their Luma answer"} />
      </div>
    </section>}
  </MeetDialog>;
}

export default function MeetRoom({ initialResult, live }: { initialResult: PilotDiscovery | null; live: boolean }) {
  const [result, setResult] = useState(initialResult);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(!initialResult);
  const [selected, setSelected] = useState("");
  const [limit, setLimit] = useState(12);
  const [member, setMember] = useState<MemberView | null>(null);
  const [dialog, setDialog] = useState<"ticket" | "card" | "pairing" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [roomError, setRoomError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [includePortfolio, setIncludePortfolio] = useState(false);
  const submittedQuery = useRef("");
  const directoryRequest = useRef(0);
  const sessionRequest = useRef(0);
  const initialized = useRef<Promise<MemberView> | null>(null);

  const load = useCallback(async (term: string, context?: string, showLoading = true) => {
    const request = ++directoryRequest.current;
    if (showLoading) setSearching(true);
    try {
      const fields = { query: term };
      let next: PilotDiscovery;
      try {
        next = await pilotRequest<PilotDiscovery>("directory", context ? { ...fields, context } : fields);
      } catch (error) {
        if (!context || !(error instanceof PilotRequestError) || error.status !== 401) throw error;
        if (request === directoryRequest.current) {
          setMember(null);
          setResult(null);
          setSelected("");
          setDialog(current => current === "card" ? "ticket" : current);
        }
        next = await pilotRequest<PilotDiscovery>("directory", fields);
      }
      if (request !== directoryRequest.current) return;
      const { member: current, ...directory } = next;
      setResult(directory);
      if (current) {
        setMember(current);
        if (!current.card) setIncludePortfolio(false);
      }
      setRoomError("");
    } catch {
      if (request !== directoryRequest.current) return;
      setResult(null);
      setRoomError("Couldn’t load today’s room. Try again.");
    } finally {
      if (request === directoryRequest.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (initialResult || !live) return;
    let active = true;
    void load("");
    const session = sessionRequest.current;
    initialized.current ??= pilotRequest<MemberView>("card");
    void initialized.current.then(view => {
      if (!active || sessionRequest.current !== session) return;
      setMember(view);
      setIncludePortfolio(view.includePortfolio);
      return load(submittedQuery.current, view.context, false);
    }).catch(() => {});
    return () => { active = false; };
  }, [initialResult, live, load]);

  useEffect(() => {
    if (!live) return;
    const refresh = () => {
      if (busy || document.visibilityState === "hidden") return;
      if (result && Date.now() >= result.expiresAt) setResult(null);
      void load(submittedQuery.current, member?.context, false);
    };
    const timer = window.setTimeout(refresh, Math.max(500, (result?.expiresAt ?? Date.now() + 60_000) - Date.now()));
    window.addEventListener("focus", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [busy, live, load, member?.context, result]);

  async function act(operation: () => Promise<void>) {
    setError(""); setNotice(""); setBusy(true);
    try { await operation(); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t complete that action.");
      if (cause instanceof PilotRequestError && cause.status === 401) {
        setMember(null);
        setResult(null);
        setDialog("ticket");
        void load(submittedQuery.current);
      }
    } finally { setBusy(false); }
  }

  function receive(view: MemberView) {
    setMember(view);
    setIncludePortfolio(view.includePortfolio);
  }

  async function clearSession() {
    sessionRequest.current++;
    setMember(null); setDialog(null); setResult(null); setSelected(""); setConfirmRemoval(false);
    await load(submittedQuery.current);
  }

  async function join(ticket: string) {
    sessionRequest.current++;
    const view = await pilotRequest<MemberView>("join", { ticket });
    receive(view);
    setDialog("card");
    await load(submittedQuery.current, view.context, false);
  }

  function closeDialog() {
    if (busy) return;
    setDialog(null); setError(""); setConfirmRemoval(false);
  }

  function selectTicket(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) void act(async () => { await join(await readTicket(file)); });
  }

  function search(term: string) {
    const trimmed = term.trim();
    submittedQuery.current = trimmed;
    setLimit(12); setSelected("");
    void load(trimmed, member?.context);
  }

  async function updateCard(action: string, fields: Record<string, unknown> = {}) {
    if (!member) return;
    const view = await pilotRequest<MemberView>(action, { ...fields, context: member.context }).catch(async cause => {
      if (cause instanceof PilotRequestError && cause.status === 409) {
        const current = await pilotRequest<MemberView>("card");
        if (current.context !== member.context) throw new PilotRequestError("Your session changed. Open your own card again.", 401);
        receive(current);
        await load(submittedQuery.current, current.context, false);
      }
      throw cause;
    });
    receive(view);
    await load(submittedQuery.current, view.context, false);
  }

  async function openCard() {
    if (!member) { setError(""); setDialog("ticket"); return; }
    await act(async () => {
      const current = await pilotRequest<MemberView>("card");
      if (current.context !== member.context) throw new PilotRequestError("Your session changed. Open your own card again.", 401);
      receive(current);
      setDialog("card");
    });
  }

  const matches = result?.matches ?? [];
  const people = result?.people ?? [];
  const selectedMatch = matches.find(match => match.person.id === selected);
  const selectedPerson = selectedMatch?.person ?? people.find(person => person.id === selected);
  const card = member?.card;
  const matched = member?.card && !member.discoveryMessage;

  return <div className="meet-content pilot-content room-content">
    <header className="room-title">
      <div>
        <h1>Here <em>today.</em></h1>
        {result?.eventName && <p className="pilot-meta">{result.eventName}</p>}
      </div>
      {live && member && <button className="meet-text-button room-own-card" type="button" disabled={busy} onClick={() => void openCard()}>
        Your card <ArrowUpRight size={15} aria-hidden="true" />
      </button>}
    </header>
    <form className="meet-search-form room-search" role="search" onSubmit={event => { event.preventDefault(); search(query); }}>
      <Search size={20} aria-hidden="true" />
      <label className="sr-only" htmlFor="room-search">Search people or projects</label>
      <input id="room-search" type="search" placeholder="Search people or projects" maxLength={240} value={query}
        onChange={event => { setQuery(event.target.value); if (!event.target.value && submittedQuery.current) search(""); }} />
      {query && <button className="meet-icon-button room-clear" type="button" aria-label="Clear search"
        onClick={() => { setQuery(""); search(""); document.getElementById("room-search")?.focus(); }}><X size={17} aria-hidden="true" /></button>}
      <button className="meet-search-submit" type="submit"><span>Search</span><ArrowRight size={18} aria-hidden="true" /></button>
    </form>
    {roomError && <p className="meet-error-text" role="alert">{roomError} <button className="meet-text-button" onClick={() => search(submittedQuery.current)}>Retry</button></p>}
    {notice && <p className="pilot-meta" role="status">{notice}</p>}
    <div className="room-grid">
      <section className="room-pairings" aria-labelledby="room-pairing-title">
        <div className="room-pairing-heading">
          <h2 id="room-pairing-title">Your pairing <em>for today</em></h2>
          <span className="room-pairing-mark" aria-hidden="true"><Link2 size={20} /></span>
        </div>
        {matches.length ? <ul className="room-match-list">{matches.map(({ person, topic }) => (
          <li key={person.id}>
            <button className="room-match" type="button" aria-haspopup="dialog" onClick={() => setSelected(person.id)}>
              <span className="room-match-name"><span className="sr-only">Meet </span>{person.card.name}</span>
              <span className="room-match-topic">Shared topic <span aria-hidden="true">·</span> <strong>{topic}</strong></span>
              <span className="room-match-arrow" aria-hidden="true"><ArrowUpRight size={16} /></span>
            </button>
          </li>
        ))}</ul> : <div className="room-match-empty">
          {live && !member ? <button className="meet-button is-dark" onClick={() => void openCard()}><Ticket size={17} aria-hidden="true" /> Use my Luma ticket</button>
            : live && member && !matched ? <>
              {member.discoveryMessage && <p>{member.discoveryMessage}</p>}
              <button className="meet-button" disabled={busy} onClick={() => void openCard()}>Your card <ArrowRight size={16} aria-hidden="true" /></button>
            </> : <p>{searching ? "Finding connections…" : "No pairings yet."}</p>}
        </div>}
        <button className="meet-text-button room-pairing-help" type="button" aria-haspopup="dialog" onClick={() => setDialog("pairing")}>
          <CircleHelp size={15} aria-hidden="true" /> How pairings work
        </button>
      </section>
      <section className="room-people" aria-labelledby="meet-results-title" aria-busy={searching}>
        <div className="room-people-heading">
          <h2 id="meet-results-title" tabIndex={-1}>{result?.query ? "Search results" : "People"}</h2>
          {result && <span className="pilot-meta">{people.length} {people.length === 1 ? "person" : "people"}</span>}
        </div>
        {searching && <p className="pilot-meta" role="status">Searching…</p>}
        {!searching && result && (people.length ? <ul className="room-roster">
          {people.slice(0, limit).map(person => <li key={person.id}>
            <button className="room-note" type="button" aria-haspopup="dialog" onClick={() => setSelected(person.id)}>
              <strong>{person.card.name}</strong>
              {person.card.project && <span className="room-note-project">{person.card.project}</span>}
              <ArrowUpRight className="room-note-arrow" size={18} aria-hidden="true" />
            </button>
          </li>)}
        </ul> : <p className="room-empty">{result.roomMessage ?? (result.query ? "No people found." : "Shared cards appear as people check in.")}</p>)}
        {people.length > limit && <button className="meet-text-button pilot-more" onClick={() => setLimit(limit + 12)}>Show more</button>}
      </section>
    </div>
    {selectedPerson && <PersonDetail person={selectedPerson} match={selectedMatch} onClose={() => setSelected("")} />}
    {dialog === "pairing" && <MeetDialog title="How pairings work" description="Up to three people with work that overlaps yours." onClose={closeDialog} className="room-dialog">
      <p className="room-dialog-copy">We look for shared topics and phrases in your Luma project answer and optional portfolio, and in the work shared by people checked in today.</p>
      {!live && <p className="pilot-meta">These pairings are for Alex Rivera, a sample attendee.</p>}
    </MeetDialog>}
    {dialog === "ticket" && <MeetDialog title="Use your Luma ticket" description="Choose a screenshot of the QR code on your ticket." onClose={closeDialog} className="room-dialog">
      {error && <p role="alert" className="meet-error-text">{error}</p>}
      <div className="room-ticket-actions">
        <label className="meet-button is-dark room-file-picker">
          <Ticket size={16} aria-hidden="true" /> {busy ? "Checking ticket…" : "Choose QR screenshot"}
          <input className="sr-only" type="file" accept="image/*" disabled={busy} onChange={selectTicket} />
        </label>
        <details className="meet-source-details">
          <summary>Paste a QR link</summary>
          <form className="meet-profile-form" onSubmit={event => {
            event.preventDefault();
            const ticket = String(new FormData(event.currentTarget).get("ticket") ?? "");
            void act(() => join(ticket));
          }}>
            <label>Luma ticket QR link<input name="ticket" type="url" autoComplete="off" required maxLength={500} disabled={busy} /></label>
            <button className="meet-button" disabled={busy}>Continue <ArrowRight size={15} aria-hidden="true" /></button>
          </form>
        </details>
      </div>
    </MeetDialog>}
    {dialog === "card" && member && <MeetDialog title={member.name} description={member.shared ? "Shared today" : "Private card"} onClose={closeDialog} className="room-dialog">
      {error && <p role="alert" className="meet-error-text">{error}</p>}
      {card ? <>
        {card.project && <p className="pilot-project">{card.project}</p>}
        {card.portfolio && <div className="pilot-portfolio">
          <a className="meet-text-button" href={card.portfolio.url} target="_blank" rel="noreferrer">Portfolio <ArrowUpRight size={14} aria-hidden="true" /></a>
          {card.portfolio.excerpts.map(excerpt => <blockquote key={excerpt.url}><p>{excerpt.text}</p></blockquote>)}
          <label className="meet-checkbox-label">
            <input type="checkbox" checked={includePortfolio} disabled={busy} onChange={event => setIncludePortfolio(event.target.checked)} />
            Show my portfolio in search
          </label>
        </div>}
        {member.portfolioUnavailable && <p className="pilot-meta">Portfolio unavailable. Your project answer is ready.</p>}
        {member.discoveryMessage && <p className="pilot-meta">{member.discoveryMessage}</p>}
        {!member.discoveryMessage && <p className="pilot-meta">Anyone can see shared cards in today’s search.</p>}
        <div className="pilot-actions">
          <button className="meet-button is-dark" disabled={busy || !!member.discoveryMessage} onClick={() => void act(async () => {
            await updateCard("share", { revision: member.revision, includePortfolio, directory: true });
            setDialog(null); setNotice("Your card is in today’s search.");
          })}>Share in today’s search</button>
          <button className="meet-text-button" disabled={busy} onClick={() => void act(async () => {
            if (member.shared) await updateCard("hide");
            setDialog(null);
          })}>Keep private</button>
        </div>
      </> : <>
        <p>Use your Luma project answer and portfolio to find people to meet.</p>
        <button className="meet-button is-dark" disabled={busy} onClick={() => void act(() => updateCard("prepare"))}>
          {busy ? "Preparing…" : "Preview my card"} <ArrowRight size={16} aria-hidden="true" />
        </button>
      </>}
      <div className="pilot-remove pilot-actions">
        {confirmRemoval ? <>
          <button className="meet-button" disabled={busy} onClick={() => void act(async () => {
            await pilotRequest("withdraw", { context: member.context });
            await clearSession();
          })}>Remove card for today</button>
          <button className="meet-text-button" disabled={busy} onClick={() => setConfirmRemoval(false)}>Cancel</button>
        </> : <>
          <button className="meet-text-button" disabled={busy} onClick={() => setConfirmRemoval(true)}>Remove my card</button>
          <button className="meet-text-button" disabled={busy} onClick={() => void act(async () => {
            await pilotRequest("leave", { context: member.context });
            await clearSession();
          })}>Sign out</button>
        </>}
      </div>
    </MeetDialog>}
  </div>;
}
