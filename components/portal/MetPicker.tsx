"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MetPerson } from "@/lib/attendance";
import { saveMetNote, toggleMet } from "@/lib/actions/attendance";
import { cn } from "@/lib/utils";

const body = "font-body text-ink/85";
const label = "font-ui text-[10px] uppercase tracking-wide text-ink/55";

/**
 * Tap the people you talked to; add a line about what you talked about.
 * Saves on every tap and on every pause in typing; nothing to submit. While
 * the Sunday is on, the list refreshes so people appear as hosts check them in.
 */
export default function MetPicker({
  eventId,
  people,
  anyCheckins,
  live,
}: {
  eventId: string;
  people: MetPerson[];
  anyCheckins: boolean;
  live: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, "saving" | "saved" | null>>({});
  const [error, setError] = useState<string | null>(null);
  const typing = useRef(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const met = (p: MetPerson) => local[p.id] ?? p.met;
  const noteOf = (p: MetPerson) => notes[p.id] ?? p.note ?? "";
  const metPeople = people.filter(met);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && !typing.current) router.refresh();
    }, 30_000);
    return () => clearInterval(t);
  }, [live, router]);

  function toggle(p: MetPerson) {
    const next = !met(p);
    setLocal((l) => ({ ...l, [p.id]: next }));
    setError(null);
    const fd = new FormData();
    fd.set("lumaEventId", eventId);
    fd.set("attendanceId", p.id);
    fd.set("on", next ? "1" : "0");
    startTransition(async () => {
      const r = await toggleMet(fd);
      if (!r.ok) {
        setLocal((l) => ({ ...l, [p.id]: !next }));
        setError(r.error);
      }
    });
  }

  function queueNote(p: MetPerson, value: string) {
    setNotes((n) => ({ ...n, [p.id]: value }));
    setSaved((s) => ({ ...s, [p.id]: null }));
    clearTimeout(timers.current[p.id]);
    timers.current[p.id] = setTimeout(() => {
      setSaved((s) => ({ ...s, [p.id]: "saving" }));
      const fd = new FormData();
      fd.set("lumaEventId", eventId);
      fd.set("attendanceId", p.id);
      fd.set("note", value);
      startTransition(async () => {
        const r = await saveMetNote(fd);
        setSaved((s) => ({ ...s, [p.id]: r.ok ? "saved" : null }));
        if (!r.ok) setError(r.error);
      });
    }, 700);
  }

  if (people.length === 0) {
    return (
      <p className={cn(body, "text-sm text-ink/55")}>
        {anyCheckins ? "No one else is checked in yet." : "Hosts haven't checked anyone in yet. Check back in a bit."}
        {live ? " This page refreshes on its own." : ""}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className={cn(body, "text-sm text-ink/55")}>
          {metPeople.length === 0 ? "Tap everyone you actually talked to." : `${metPeople.length} ${metPeople.length === 1 ? "person" : "people"} marked. Tap again to undo.`}
          {!anyCheckins ? " This list is from RSVPs, since no one was checked in at the door." : ""}
          {live ? " New arrivals show up as hosts check them in." : ""}
        </p>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {people.map((p) => {
            const on = met(p);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p)}
                  aria-pressed={on}
                  className={cn(
                    "flex w-full flex-col items-center gap-2 rounded-[20px] border p-3 text-center transition-colors",
                    on ? "border-ink bg-lime" : "border-ink/15 bg-paper-2 hover:bg-blueberry-200/30"
                  )}
                >
                  {p.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatarUrl} alt="" width={56} height={56} className="h-14 w-14 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className={cn("flex h-14 w-14 items-center justify-center rounded-full font-ui text-lg", on ? "bg-ink text-lime" : "bg-blueberry-200/50 text-ink")}>{p.initial}</span>
                  )}
                  <span className={cn(body, "w-full truncate text-sm text-ink")}>{p.firstName}</span>
                  {p.school ? <span className="font-ui text-[9px] uppercase tracking-wide text-ink/55">{p.school}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {metPeople.length > 0 ? (
        <div className="space-y-3 border-t border-dashed border-ink/15 pt-6">
          <div className="flex items-baseline justify-between">
            <h3 className={label}>What you talked about</h3>
            <span className={cn(label, "text-ink/40")}>optional · only you see this</span>
          </div>
          <ul className="space-y-3">
            {metPeople.map((p) => (
              <li key={p.id} className="flex items-start gap-3">
                <span className="mt-2 w-20 shrink-0 truncate font-body text-sm text-ink">{p.firstName}</span>
                <div className="min-w-0 flex-1">
                  <input
                    value={noteOf(p)}
                    onChange={(e) => queueNote(p, e.target.value)}
                    onFocus={() => (typing.current = true)}
                    onBlur={() => (typing.current = false)}
                    maxLength={500}
                    placeholder="e.g. her zine about LA buses, wants a Figma intro"
                    className="h-10 w-full rounded-2xl border border-ink/15 bg-white px-3.5 font-body text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-lime"
                  />
                  <span className={cn(label, "mt-1 block h-3 text-ink/40")} aria-live="polite">
                    {saved[p.id] === "saving" ? "saving…" : saved[p.id] === "saved" ? "saved" : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className={cn(body, "text-sm text-red-700")}>{error}</p> : null}
    </div>
  );
}
