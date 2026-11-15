"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/Button";
import { inputClass } from "@/components/portal/AddressInput";
import type { AttendeeView } from "@/lib/attendance";
import { adminAddWalkIn, adminSetCheckedIn, adminSyncGuests } from "@/lib/actions/attendance";
import { cn } from "@/lib/utils";

const label = "font-ui text-[10px] uppercase tracking-wide text-ink/55";
const body = "font-body text-ink/85";

function Avatar({ p, size = 40 }: { p: AttendeeView; size?: number }) {
  return p.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.avatarUrl} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} referrerPolicy="no-referrer" />
  ) : (
    <span className="flex items-center justify-center rounded-full bg-blueberry-200/50 font-ui text-sm text-ink" style={{ width: size, height: size }}>
      {p.initial}
    </span>
  );
}

/**
 * The door list. Built for a phone: big rows, one tap to check someone in,
 * search at the top, walk-ins at the bottom.
 */
export default function CheckinList({
  eventId,
  eventTitle,
  attendees,
  choices,
}: {
  eventId: string;
  eventTitle: string;
  attendees: AttendeeView[];
  choices: { lumaEventId: string; title: string; startAt: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [formKey, setFormKey] = useState(0);

  const isIn = (p: AttendeeView) => local[p.id] ?? !!p.checkedInAt;
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? attendees.filter((p) => p.name.toLowerCase().includes(s) || (p.email ?? "").includes(s)) : attendees;
  }, [attendees, q]);
  const here = attendees.filter(isIn).length;

  function toggle(p: AttendeeView) {
    const next = !isIn(p);
    setLocal((l) => ({ ...l, [p.id]: next }));
    const fd = new FormData();
    fd.set("attendanceId", p.id);
    fd.set("on", next ? "1" : "0");
    startTransition(async () => {
      const r = await adminSetCheckedIn(fd);
      if (!r.ok) {
        setLocal((l) => ({ ...l, [p.id]: !next }));
        setNotice({ tone: "error", text: r.error });
      }
    });
  }

  return (
    <div className="space-y-6">
      {choices.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {choices.map((c) => (
            <Link
              key={c.lumaEventId}
              href={`/portal/admin/checkin?event=${encodeURIComponent(c.lumaEventId)}`}
              className={cn(
                "rounded-full border px-3 pt-1.5 pb-1 font-ui text-[10px] uppercase tracking-wide",
                c.lumaEventId === eventId ? "border-ink bg-ink text-paper" : "border-ink/20 text-ink hover:bg-blueberry-200/30"
              )}
            >
              {new Date(c.startAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" })}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={label}>{eventTitle}</p>
          <p className="font-mono text-3xl text-ink tabular-nums">
            {here} <span className="text-ink/40">/ {attendees.length}</span>
          </p>
          <p className={cn(body, "text-sm text-ink/55")}>here so far · {attendees.filter((p) => p.firstTime).length} first-timers on the list</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            const fd = new FormData();
            fd.set("lumaEventId", eventId);
            startTransition(async () => {
              const r = await adminSyncGuests(fd);
              setNotice(r.ok ? { tone: "ok", text: `Pulled ${r.synced ?? 0} from Luma.` } : { tone: "error", text: r.error });
              if (r.ok) router.refresh();
            });
          }}
        >
          Pull RSVPs from Luma
        </Button>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search names"
        className={inputClass}
        inputMode="search"
      />

      {notice ? <p className={cn(body, "text-sm", notice.tone === "error" ? "text-red-700" : "text-ink/75")} role="status">{notice.text}</p> : null}

      <ul className="divide-y divide-dashed divide-ink/12 border-t border-ink/15">
        {filtered.length === 0 ? (
          <li className={cn(body, "py-6 text-sm text-ink/55")}>{attendees.length === 0 ? "No RSVPs yet. Pull from Luma, or add walk-ins below." : "No one matches that."}</li>
        ) : (
          filtered.map((p) => {
            const on = isIn(p);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p)}
                  className="flex w-full items-center gap-4 py-3 text-left"
                  aria-pressed={on}
                >
                  <Avatar p={p} />
                  <span className="min-w-0 flex-1">
                    <span className={cn(body, "block truncate text-base text-ink")}>{p.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2">
                      {p.school ? <span className={label}>{p.school}</span> : null}
                      {p.firstTime ? <span className="rounded-full bg-lime px-2 pt-[3px] pb-[2px] font-ui text-[9px] uppercase tracking-wide text-ink">first time</span> : null}
                      {p.guest ? <span className={label}>no account</span> : null}
                      {p.status === "walkin" ? <span className={label}>walk-in</span> : null}
                      {p.status === "host" ? <span className="rounded-full bg-blueberry-200/60 px-2 pt-[3px] pb-[2px] font-ui text-[9px] uppercase tracking-wide text-ink">host</span> : null}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-3 pt-1.5 pb-1 font-ui text-[11px] uppercase tracking-wide transition-colors",
                      on ? "border-ink bg-ink text-lime" : "border-ink/25 text-ink/70"
                    )}
                  >
                    {on ? "Here" : "Check in"}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>

      <form
        key={formKey}
        className="space-y-3 border-t border-dashed border-ink/15 pt-6"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("lumaEventId", eventId);
          startTransition(async () => {
            const r = await adminAddWalkIn(fd);
            if (r.ok) {
              setFormKey((k) => k + 1);
              setNotice({ tone: "ok", text: "Added and checked in." });
              router.refresh();
            } else setNotice({ tone: "error", text: r.error });
          });
        }}
      >
        <p className={label}>Someone who just showed up</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input name="name" required placeholder="Name" className={inputClass} autoComplete="off" />
          <input name="email" type="email" placeholder="Email (so it links to their account later)" className={inputClass} autoComplete="off" />
          <Button type="submit" variant="dark" size="md" disabled={pending}>
            Add
          </Button>
        </div>
      </form>
    </div>
  );
}
