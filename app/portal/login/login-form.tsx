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
        <Eyebrow>Portal</Eyebrow>
        <h1 className="font-['Office-Times-Sharp-Regular'] text-3xl lowercase text-[#010101] md:text-4xl">
          welcome back
        </h1>
        <p className="font-['Office-Times-Round'] text-base text-[#3A372F]">
          Sign in to RSVP, manage your profile, and find a carpool.
        </p>
      </section>

      {error && (
        <p className="rounded-2xl bg-[#EEEBE3] px-4 py-3 font-['Office-Times-Round'] text-sm text-[#3A372F]">
          Something went wrong signing in. Try again, or use a different method.
        </p>
      )}

      {sent ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-[#C0B9A5] bg-[#FCFAF7] px-5 py-6 text-center">
          <p className="font-['Office-Times-Sharp-Regular'] text-lg lowercase text-[#010101]">
            check your email
          </p>
          <p className="font-['Office-Times-Round'] text-sm text-[#3A372F]">
            We sent a magic link. It may take a minute — check spam if you don&apos;t see it.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-['Monument-Grotesk'] text-[11px] uppercase text-[#C0B9A5] hover:text-[#8a8478]"
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
            <div className="h-px flex-1 bg-[#C0B9A5]/40" />
            <span className="font-['Monument-Grotesk'] text-[10px] uppercase text-[#C0B9A5]">
              or email
            </span>
            <div className="h-px flex-1 bg-[#C0B9A5]/40" />
          </div>

          <form onSubmit={onEmailSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="font-['Monument-Grotesk'] text-[11px] uppercase tracking-wide text-[#C0B9A5]">
                Email
              </span>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
                className="h-11 rounded-2xl border-[#C0B9A5]/60 bg-white font-['Office-Times-Round'] text-base text-[#010101] placeholder:text-[#C0B9A5] focus-visible:ring-[#C0B9A5]"
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
