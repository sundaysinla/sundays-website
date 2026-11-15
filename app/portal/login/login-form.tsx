"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Eyebrow from "@/components/Eyebrow";
import Button from "@/components/Button";
import { Input } from "@/components/ui/input";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/portal";
  const verify = searchParams.get("verify");
  const error = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(!!verify);

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setPending(true);
    try {
      await signIn("resend", { email: email.trim(), callbackUrl, redirect: false });
      setSent(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-10">
      <section className="space-y-3 text-center">
        <Eyebrow className="font-ui text-blueberry">Portal</Eyebrow>
        <h1 className="font-heading text-3xl lowercase text-ink md:text-4xl">
          welcome back
        </h1>
        <p className="font-body text-base text-ink/75">
          Sign in to RSVP, manage your profile, and find a carpool.
        </p>
      </section>

      {error && (
        <p className="rounded-2xl bg-paper-2 px-4 py-3 font-body text-sm text-ink/75">
          Something went wrong signing in. Try again, or use a different method.
        </p>
      )}

      {sent ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-ink/25 bg-paper-2 px-5 py-6 text-center">
          <p className="font-heading text-xl lowercase text-ink">
            check your email
          </p>
          <p className="font-body text-sm text-ink/75">
            We sent a magic link. It may take a minute — check spam if you don&apos;t see it.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-ui text-[11px] uppercase text-ink/55 hover:text-ink"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <>
          <Button
            type="button"
            variant="dark"
            size="lg"
            className="w-full"
            onClick={() => signIn("google", { callbackUrl })}
          >
            Continue with Google
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-ink/15" />
            <span className="font-ui text-[10px] uppercase text-ink/55">
              or email
            </span>
            <div className="h-px flex-1 bg-ink/15" />
          </div>

          <form onSubmit={onEmailSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="font-ui text-[11px] uppercase tracking-wide text-ink/55">
                Email
              </span>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
                className="h-11 rounded-2xl border-ink/15 bg-white font-body text-base text-ink placeholder:text-ink/35 focus-visible:ring-lime"
              />
            </label>
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
              {pending ? "Sending…" : "Send magic link"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
