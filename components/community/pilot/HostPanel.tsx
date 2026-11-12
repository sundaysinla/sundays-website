"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Copy, RefreshCw } from "lucide-react";
import type { IntakeEvent } from "@/lib/community/pilot/intake";
import type { HostEvent } from "@/lib/community/pilot/store";
import { PilotRequestError, pilotRequest } from "./client";

type Dashboard = { events: HostEvent[]; liveConfigured: boolean; form: { link: string } };
type Claim = { name: string; path: string };

function formatTime(value: string | number, timezone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    ...(timezone ? { timeZone: timezone, timeZoneName: "short" } : {}),
  }).format(new Date(value));
}

export default function HostPanel() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [key, setKey] = useState("");
  const [event, setEvent] = useState<IntakeEvent | null>(null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void pilotRequest<Dashboard>("host-view").then(data => { if (active) setDashboard(data); }).catch(error => {
      if (active && (!(error instanceof PilotRequestError) || error.status !== 401)) setError("Couldn’t open the host panel.");
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function run(operation: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await operation(); }
    catch (error) {
      setError(error instanceof Error ? error.message : "Couldn’t complete that action.");
      if (error instanceof PilotRequestError && error.status === 401) { setDashboard(null); setClaim(null); }
    } finally { setBusy(false); }
  }

  function login(submit: FormEvent) {
    submit.preventDefault();
    void run(async () => {
      await pilotRequest("host-login", { key });
      setKey("");
      setDashboard(await pilotRequest<Dashboard>("host-view"));
    });
  }

  const inspect = () => run(async () => {
    setEvent(null);
    const data = await pilotRequest<{ event: IntakeEvent }>("host-inspect");
    setEvent(data.event);
    setDashboard(await pilotRequest<Dashboard>("host-view"));
  });

  const sync = (source: "luma" | "sample") => run(async () => {
    setClaim(null);
    setDashboard(await pilotRequest<Dashboard>("host-sync", { source }));
    setNotice(source === "sample" ? "Sample RSVPs imported." : "Guest list refreshed.");
  });

  const issue = (eventId: string, guestId: string, name: string) => run(async () => {
    setClaim(null);
    const { claimPath } = await pilotRequest<{ claimPath: string }>("host-issue", { eventId, guestId });
    setClaim({ name, path: claimPath });
  });

  return (
    <div className="meet-content pilot-content">
      <div className="pilot-heading">
        <h1>Sundays host.</h1>
        {dashboard && <button className="meet-text-button" disabled={busy} onClick={() => void run(async () => {
          await pilotRequest("host-logout"); setDashboard(null); setEvent(null); setClaim(null);
        })}>Sign out</button>}
      </div>
      {error && <p role="alert" className="meet-error-text">{error}</p>}
      {notice && <p role="status" className="meet-inline-success"><Check size={16} />{notice}</p>}
      {!dashboard ? (
        <form className="pilot-panel pilot-sign-in meet-profile-form" onSubmit={login}>
          <label>Host key<input type="password" autoComplete="off" required value={key} onChange={e => setKey(e.target.value)} /></label>
          <button className="meet-button is-dark" disabled={busy}>Sign in</button>
        </form>
      ) : <>
        <div className="pilot-sources">
          <section className="pilot-panel" aria-label="Luma event">
            <div className="pilot-section-heading"><h2>Luma event</h2><button className="meet-button" disabled={busy || !dashboard.liveConfigured} onClick={() => void inspect()}><RefreshCw size={14} /> Check event</button></div>
            {!dashboard.liveConfigured && <p>Set a Luma event ID in your local settings.</p>}
            {event && <>
              <h3>{event.name}</h3><p className="pilot-meta">{formatTime(event.startAt, event.timezone)}</p>
              <ul className="pilot-checklist">
                <li>{event.projectQuestion ? "Project question found" : "Project question not found"}</li>
                <li>{event.linkQuestion ? "Optional portfolio field found" : "Portfolio field not set (optional)"}</li>
              </ul>
              {!event.linkQuestion && <p className="pilot-meta">In Luma, add an optional Website field named <b>{dashboard.form.link}</b>.</p>}
              <button className="meet-button is-dark" disabled={busy || !event.projectQuestion} onClick={() => void sync("luma")}>Sync guests</button>
            </>}
          </section>
          <section className="pilot-panel" aria-label="Sample RSVPs">
            <div className="pilot-section-heading"><h2>Sample RSVPs</h2></div>
            <button className="meet-button" disabled={busy} onClick={() => void sync("sample")}>Import sample RSVPs</button>
          </section>
        </div>
        {claim && <section className="pilot-panel pilot-claim" aria-label="Claim link">
          <h2>Claim link for {claim.name}</h2>
          <p>Give this link to {claim.name} directly. It works once and expires in 20 minutes.</p>
          <div className="pilot-actions">
            <a className="meet-button is-dark" href={claim.path} target="_blank" rel="noreferrer">Open claim link <ArrowUpRight size={15} /></a>
            <button className="meet-button" onClick={() => void run(async () => {
              await navigator.clipboard.writeText(new URL(claim.path, window.location.origin).href);
              setNotice("Claim link copied.");
            })}><Copy size={15} /> Copy link</button>
            <button className="meet-text-button" onClick={() => setClaim(null)}>Dismiss</button>
          </div>
        </section>}
        {dashboard.events.map(({ event, guests, syncedAt, blocked }) => (
          <section key={event.id} className="pilot-panel pilot-roster" aria-label={event.name}>
            <div className="pilot-section-heading"><h2>{event.name}</h2><p className="pilot-meta">Synced {formatTime(syncedAt)}</p></div>
            {blocked && <p role="status">Check the project question in Luma, then sync again.</p>}
            {guests.length ? <ul className="pilot-guests">{guests.map(guest => (
              <li key={guest.id} className="pilot-guest">
                <strong>{guest.name}</strong>
                <span className="pilot-meta">{guest.attendance === "checked-in" ? "Checked in" : "RSVP"} · {guest.shared ? "Shared" : "Private"}</span>
                <button className="meet-button" disabled={busy || blocked || guest.claimBlocked} aria-label={"Create claim link for " + guest.name} onClick={() => void issue(event.id, guest.id, guest.name)}>{guest.claimBlocked ? "Duplicate RSVP name" : "Create claim link"}</button>
              </li>
            ))}</ul> : <p>No approved RSVPs yet.</p>}
          </section>
        ))}
      </>}
    </div>
  );
}
