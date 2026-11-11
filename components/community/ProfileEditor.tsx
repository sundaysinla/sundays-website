"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDownToLine, Check, Github, Loader2, RotateCcw } from "lucide-react";
import type { ViewerProfile, ProfileDraft, Discipline, Campus, Visibility } from "@/lib/community/types";
import { profileSchema } from "@/lib/community/schemas";
import { applyReviewedDraft } from "@/lib/community/profile-draft";
import MeetDialog from "./MeetDialog";

const split = (text: string) => [...new Set(text.split(",").map(t => t.trim()).filter(Boolean))];

export default function ProfileEditor({ initial, liveImportEnabled, onSave, onClose, onReset }: {
  initial: ViewerProfile; liveImportEnabled: boolean; onSave: (profile: ViewerProfile) => void; onClose: () => void; onReset: () => void;
}) {
  const [profile, setProfile] = useState(initial);
  const [interests, setInterests] = useState(initial.interests.join(", "));
  const [offers, setOffers] = useState(initial.offers.join(", "));
  const [asks, setAsks] = useState(initial.asks.join(", "));
  const [consent, setConsent] = useState(false);
  const [source, setSource] = useState<"sample" | "public">("sample");
  const [username, setUsername] = useState("");
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [useProject, setUseProject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [importNotice, setImportNotice] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);
  const importRequest = useRef<AbortController | null>(null);
  useEffect(() => () => importRequest.current?.abort(), []);
  function change<K extends keyof ViewerProfile>(key: K, value: ViewerProfile[K]) { setProfile(p => ({ ...p, [key]: value })); }
  const invalidateImport = () => {
    importRequest.current?.abort(); importRequest.current = null;
    setBusy(false); setDraft(null); setSelected([]); setUseProject(false); setError(""); setImportNotice("");
  };

  const importDraft = async () => {
    if (!consent) return;
    invalidateImport();
    const controller = new AbortController();
    importRequest.current = controller;
    setBusy(true); setError(""); setDraft(null); setSelected([]); setImportNotice("");
    try {
      const response = await fetch("/api/community/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: source, consent, username: username || "demo-maker" }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "That source could not be read. Try again.");
      if (!controller.signal.aborted && importRequest.current === controller) { setDraft(data); setUseProject(false); }
    } catch (e) { if (!controller.signal.aborted && importRequest.current === controller) setError(e instanceof Error ? e.message : "The import was interrupted. Try again."); }
    finally { if (importRequest.current === controller && !controller.signal.aborted) setBusy(false); }
  };
  const applyDraft = () => {
    if (!draft || !consent || busy || (source === "sample" ? draft.source !== "sample-github" : draft.source !== "github")) return;
    try {
      const next = applyReviewedDraft(profile, split(interests), draft, selected, useProject);
      setInterests(next.interests.join(", ")); setProfile(next);
    } catch (e) { setError(e instanceof Error ? e.message : "Those details could not be added."); return; }
    setImportNotice("Details added.");
    setDraft(null);
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    const values = split(interests);
    const parsed = profileSchema.safeParse({ ...profile, interests: values, offers: split(offers), asks: split(asks), importedClaims: profile.importedClaims.filter(c => values.includes(c.value)) });
    if (!parsed.success) { setError(parsed.error.issues.map(i => `${i.path.join(" ")}: ${i.message}`).slice(0, 2).join(". ")); return; }
    setError(""); onSave(parsed.data);
  };
  return (
    <MeetDialog wide title="Your profile." description="Projects, interests, asks & offers." onClose={onClose}>
      <form onSubmit={save} className="meet-profile-form">
        <div className="meet-editor-grid">
          <label>Your name<input value={profile.name} maxLength={80} required onChange={e => change("name", e.target.value)} /></label>
          <label>What do you call your practice?<input value={profile.practice} maxLength={60} required onChange={e => change("practice", e.target.value)} /></label>
          <label>Creative corner<select value={profile.discipline} onChange={e => change("discipline", e.target.value as Discipline)}>{["technology", "film", "music", "design", "craft", "writing", "research"].map(d => <option key={d}>{d}</option>)}</select></label>
          <label>Where you’re based<select value={profile.campus} onChange={e => change("campus", e.target.value as Campus)}>{["USC", "UCLA", "Los Angeles"].map(c => <option key={c}>{c}</option>)}</select></label>
        </div>
        <label>A line about you<input value={profile.bio} maxLength={180} onChange={e => change("bio", e.target.value)} placeholder="The things you keep coming back to…" /></label>
        <div className="meet-form-divider"><span className="meet-eyebrow">on your worktable</span></div>
        <label>What are you making?<input value={profile.projectTitle} maxLength={80} required onChange={e => change("projectTitle", e.target.value)} /></label>
        <label>A little context<textarea value={profile.projectSummary} maxLength={300} required rows={2} onChange={e => change("projectSummary", e.target.value)} /></label>
        {profile.importedProject && <p className="meet-source-note">Imported from <a href={profile.importedProject.sourceUrl} target="_blank" rel="noreferrer">GitHub</a> · {new Date(profile.importedProject.fetchedAt).toLocaleDateString()}</p>}
        <label>You’re curious about<input value={interests} maxLength={500} onChange={e => setInterests(e.target.value)} /><small>A few interests, separated by commas.</small></label>
        {profile.importedClaims.some(c => split(interests).includes(c.value)) && <details className="meet-source-details"><summary>Sources for imported interests</summary><ul>{profile.importedClaims.filter(c => split(interests).includes(c.value)).map(c => <li key={c.id}>{c.value} · <a href={c.sourceUrl} target="_blank" rel="noreferrer">{c.sourceLabel}</a></li>)}</ul></details>}
        <div className="meet-editor-grid">
          <label>You can offer<input value={offers} maxLength={500} onChange={e => setOffers(e.target.value)} /></label>
          <label>You could use a hand with<input value={asks} maxLength={500} onChange={e => setAsks(e.target.value)} /></label>
        </div>
        <section className="meet-import-section">
          <div className="meet-form-divider"><span className="meet-eyebrow">Import from GitHub</span></div>
          {liveImportEnabled && <div className="meet-source-picker"><button type="button" className={`meet-chip ${source === "sample" ? "is-selected" : ""}`} onClick={() => { invalidateImport(); setSource("sample"); setConsent(false); }}>Example profile</button><button type="button" className={`meet-chip ${source === "public" ? "is-selected" : ""}`} onClick={() => { invalidateImport(); setSource("public"); setConsent(false); }}>My GitHub</button></div>}
          {source === "public" && <label>GitHub username<input value={username} onChange={e => { invalidateImport(); setUsername(e.target.value); }} maxLength={39} placeholder="your-username" /></label>}
          <label className="meet-checkbox-label"><input type="checkbox" checked={consent} onChange={e => { invalidateImport(); setConsent(e.target.checked); }} />{source === "sample" ? "Use the example GitHub profile." : "I own this GitHub profile and agree to import its public repository details."}</label>
          <button type="button" className="meet-button" onClick={importDraft} disabled={!consent || busy || (source === "public" && !username.trim())}>{busy ? <Loader2 size={16} className="meet-spin" /> : <Github size={16} />}{busy ? "Importing…" : source === "sample" ? "Import example" : "Import from GitHub"}</button>
          {draft && <div className="meet-draft-review" aria-label="Review imported draft"><span className="meet-eyebrow">Add to your profile</span>{!draft.suggestions.length && !draft.project && <p>No public projects found.</p>}{draft.suggestions.map(s => <label key={s.id} className="meet-claim"><input type="checkbox" checked={selected.includes(s.id)} onChange={e => setSelected(values => e.target.checked ? [...values, s.id] : values.filter(id => id !== s.id))} /><span>{s.value}<small>{s.sourceLabel}</small></span></label>)}{draft.project?.summary && <label className="meet-claim"><input type="checkbox" checked={useProject} onChange={e => setUseProject(e.target.checked)} /><span>Use “{draft.project.title}” as my project<small>{draft.project.summary}</small></span></label>}<button type="button" className="meet-button" onClick={applyDraft} disabled={!selected.length && !useProject}><ArrowDownToLine size={15} /> Add selected</button></div>}
          {importNotice && <p role="status" className="meet-inline-success"><Check size={15} />{importNotice}</p>}
        </section>
        <section className="meet-visibility-section">
          <fieldset><legend>Who can find you</legend>{([
            ["private", "Keep it private", "Browse without joining discovery."],
            ["session", "Just this Sunday", "Only people in this session."],
            ["community", "Sundays community", "Also discoverable across Sundays."],
          ] as [Visibility, string, string][]).map(([value, label, help]) => <label key={value} className={`meet-radio-card ${profile.visibility === value ? "is-selected" : ""}`}><input type="radio" name="visibility" value={value} checked={profile.visibility === value} onChange={() => change("visibility", value)} /><span>{label}<small>{help}</small></span></label>)}</fieldset>
          <label className="meet-checkbox-label"><input type="checkbox" checked={profile.openToMeet} onChange={e => change("openToMeet", e.target.checked)} />I’m open to a hello this Sunday.</label>
        </section>
        {error && <p className="meet-error-text" role="alert">{error}</p>}
        <div className="meet-save-row"><button type="submit" className="meet-button is-dark" disabled={busy}>Save profile <Check size={15} /></button><button type="button" className="meet-text-button" onClick={onClose}>Cancel</button></div>
        <div className="meet-reset-row">{resetConfirm ? <><p>Reset your profile, introductions, and feedback?</p><button type="button" className="meet-button" onClick={onReset}>Reset everything</button><button type="button" className="meet-text-button" onClick={() => setResetConfirm(false)}>Keep it</button></> : <button type="button" className="meet-text-button" onClick={() => setResetConfirm(true)}><RotateCcw size={13} />Reset everything</button>}</div>
      </form>
    </MeetDialog>
  );
}
