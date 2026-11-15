"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import type { MessageView } from "@/lib/carpool/messages";
import { cn } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

const label = "font-ui text-[10px] uppercase tracking-wide text-ink/55";
const body = "font-body text-ink/85";

function when(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return d.toLocaleString("en-US", {
    ...(sameDay ? {} : { weekday: "short" }),
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

/**
 * One car's group thread. Used on the member page (posting as yourself) and
 * on the host board (posting as a host). `post` receives carId + body.
 */
export default function CarThread({
  carId,
  messages,
  post,
  myOfferId = null,
  placeholder = "Running late? Changed plans? Tell the car.",
  compact = false,
  emptyText = "Nothing yet. Say hi, or share where you'll be waiting.",
}: {
  carId: string;
  messages: MessageView[];
  post: (fd: FormData) => Promise<Result>;
  myOfferId?: string | null;
  placeholder?: string;
  compact?: boolean;
  emptyText?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  return (
    <div className="space-y-3">
      <div className={cn("space-y-2 overflow-y-auto pr-1", compact ? "max-h-56" : "max-h-80")}>
        {messages.length === 0 ? (
          <p className={cn(body, "text-sm text-ink/55")}>{emptyText}</p>
        ) : (
          messages.map((m) => {
            const mine = !!myOfferId && m.authorOfferId === myOfferId;
            return (
              <div key={m.id} className={cn("flex flex-col gap-0.5", mine ? "items-end" : "items-start")}>
                <div className={cn("flex items-baseline gap-2", mine ? "flex-row-reverse" : "")}>
                  <span className={cn(label, m.isHost ? "text-ink" : "")}>
                    {mine ? "you" : m.authorName ?? m.authorFirstName}
                    {m.isHost ? " · host" : ""}
                  </span>
                  <span className={cn(label, "text-ink/55 normal-case tracking-normal")}>{when(m.createdAt)}</span>
                </div>
                <p
                  className={cn(
                    body,
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[15px]",
                    mine ? "bg-ink text-paper" : m.isHost ? "border border-dashed border-ink/25 bg-paper" : "bg-paper-2"
                  )}
                >
                  {m.body}
                </p>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setError(null);
          const fd = new FormData();
          fd.set("carId", carId);
          fd.set("body", text);
          startTransition(async () => {
            const r = await post(fd);
            if (r.ok) {
              setText("");
              router.refresh();
            } else setError(r.error);
          });
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
            }
          }}
          rows={compact ? 1 : 2}
          maxLength={600}
          placeholder={placeholder}
          className="min-h-[44px] flex-1 resize-none rounded-2xl border border-ink/15 bg-white px-4 py-2.5 font-body text-[15px] text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-lime"
        />
        <Button type="submit" variant="dark" size="sm" disabled={pending || !text.trim()}>
          {pending ? "…" : "Send"}
        </Button>
      </form>
      {error ? <p className={cn(body, "text-sm text-red-700")}>{error}</p> : null}
    </div>
  );
}
