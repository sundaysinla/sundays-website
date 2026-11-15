"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import PillToggle from "@/components/portal/PillToggle";
import { inputClass } from "@/components/portal/AddressInput";
import { oneClickRsvp, refreshLumaData } from "@/lib/actions/rsvp";

type Result = Awaited<ReturnType<typeof oneClickRsvp>>;

const NEW = "__new";

export default function RsvpForm({
  demos,
  alreadyGoing,
  lumaUrl,
  hasEvent,
}: {
  demos: { id: string; title: string }[];
  alreadyGoing: boolean;
  lumaUrl: string | null;
  hasEvent: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<string>(demos[0]?.title ?? NEW);
  const [result, setResult] = useState<Result | null>(null);

  if (!hasEvent) {
    return (
      <div className="space-y-4">
        <p className="font-body text-base text-ink/75">
          No upcoming event is on the calendar yet. Sync from Luma, or open the calendar.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const r = await refreshLumaData();
                setResult(r);
                if (r.ok) router.refresh();
              });
            }}
          >
            Sync from Luma
          </Button>
          <Button href="https://luma.com/sundaysinla" variant="dark" size="md" external>
            Open Luma
          </Button>
        </div>
        {result && !result.ok && (
          <p className="font-body text-sm text-red-700">{result.error}</p>
        )}
      </div>
    );
  }

  if (alreadyGoing) {
    return (
      <div className="space-y-4 rounded-[24px] border border-dashed border-ink/25 bg-paper-2 px-6 py-6">
        <p className="font-heading text-2xl lowercase text-ink">
          you&apos;re going
        </p>
        <p className="font-body text-sm text-ink/75">
          All set for this week. Need a ride across campus, or have seats to spare?
        </p>
        <div className="flex flex-wrap gap-3">
          <Button href="/portal/carpool" variant="dark" size="md">
            Carpool
          </Button>
          {lumaUrl && (
            <Button href={lumaUrl} variant="outline" size="md" external>
              View on Luma
            </Button>
          )}
        </div>
      </div>
    );
  }

  const isNew = choice === NEW;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (!isNew) fd.set("workingOn", choice);
        startTransition(async () => {
          const r = await oneClickRsvp(fd);
          setResult(r);
          if (r.ok) router.refresh();
        });
      }}
    >
      <div className="space-y-3">
        <span className="block font-ui text-[11px] uppercase tracking-wide text-ink/55">
          What are you working on?
        </span>
        {demos.length > 0 ? (
          <PillToggle
            aria-label="What are you working on"
            value={choice}
            onChange={setChoice}
            options={[
              ...demos.map((d) => ({ value: d.title, label: d.title })),
              { value: NEW, label: "Something new" },
            ]}
          />
        ) : null}
        {isNew || demos.length === 0 ? (
          <input
            name="customWorkingOn"
            required
            autoFocus={demos.length > 0}
            placeholder="This week's project, or the book you're reading"
            className={inputClass}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="dark" size="lg" disabled={pending}>
          {pending ? "Registering…" : "RSVP for Sunday"}
        </Button>
        {lumaUrl && (
          <Button href={lumaUrl} variant="ghost" size="md" external>
            Open on Luma
          </Button>
        )}
      </div>

      {result && (
        <p
          className={`font-body text-sm ${
            result.ok ? "text-ink/75" : "text-red-700"
          }`}
          role="status"
        >
          {result.ok ? "You're registered — see you Sunday." : result.error}
        </p>
      )}
    </form>
  );
}
