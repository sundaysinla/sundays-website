"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PillToggle from "@/components/portal/PillToggle";
import { updateAvatar } from "@/lib/actions/avatar";
import { formatPhone } from "@/lib/phone";
import {
  updateProfile,
  requestContactEmailChange,
  addDemo,
  deleteDemo,
  updateLumaEmail,
  type ActionResult,
} from "@/lib/actions/profile";

/** Crop to a centered square and resize to 512px, as a JPEG, before upload. */
async function shrinkImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file isn't an image the browser can open"));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const size = Math.min(512, side);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't process the image");
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) throw new Error("Couldn't process the image");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-ui text-[11px] uppercase tracking-wide text-ink/55">
      {children}
    </span>
  );
}

const inputClass =
  "h-11 rounded-2xl border-ink/15 bg-white font-body text-base text-ink placeholder:text-ink/35 focus-visible:ring-lime";

function Status({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  if (result.ok) {
    return (
      <p className="font-body text-sm text-ink/75">Saved.</p>
    );
  }
  return (
    <p className="font-body text-sm text-red-700">{result.error}</p>
  );
}

type ProfileData = {
  displayName: string | null;
  bio: string | null;
  portfolioUrl: string | null;
  school: string | null;
  phone: string | null;
  contactEmail: string;
  contactEmailVerified: boolean;
  pendingContactEmail: string | null;
};

type Demo = {
  id: string;
  title: string;
  notes: string | null;
};

export default function ProfileForms({
  profile,
  demos,
  lumaGuestEmail,
  avatarUrl,
  googleImage,
}: {
  profile: ProfileData;
  demos: Demo[];
  lumaGuestEmail: string;
  avatarUrl: string | null;
  googleImage: string | null;
}) {
  const [avatarResult, setAvatarResult] = useState<ActionResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [school, setSchool] = useState<"" | "USC" | "UCLA" | "other">(
    (profile.school as "USC" | "UCLA" | "other" | null) ?? ""
  );
  const [profileResult, setProfileResult] = useState<ActionResult | null>(null);
  const [emailResult, setEmailResult] = useState<ActionResult | null>(null);
  const [demoResult, setDemoResult] = useState<ActionResult | null>(null);
  const [lumaResult, setLumaResult] = useState<ActionResult | null>(null);

  function run(
    action: (fd: FormData) => Promise<ActionResult>,
    setResult: (r: ActionResult) => void,
    formData: FormData
  ) {
    startTransition(async () => {
      const result = await action(formData);
      setResult(result);
      if (result.ok) router.refresh();
    });
  }

  const avatarFd = (mode: string, url?: string) => {
    const f = new FormData();
    f.set("mode", mode);
    if (url) f.set("url", url);
    return f;
  };

  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <div>
          <FieldLabel>Photo</FieldLabel>
          <p className="mt-1 font-body text-sm text-ink/55">
            Shown in the header and, later, to people you&apos;ve met at Sundays.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" width={64} height={64} className="h-16 w-16 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-paper-2 font-ui text-xl text-ink">
              {(profile.displayName?.trim()?.[0] ?? "?").toUpperCase()}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {googleImage && googleImage !== avatarUrl ? (
              <Button type="button" variant="outline" size="md" disabled={pending} onClick={() => run(updateAvatar, setAvatarResult, avatarFd("google"))}>
                Use Google photo
              </Button>
            ) : null}
            {avatarUrl ? (
              <button type="button" disabled={pending} onClick={() => run(updateAvatar, setAvatarResult, avatarFd("remove"))} className="font-ui text-[11px] uppercase text-ink/55 hover:text-ink">
                Remove
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-2xl border border-ink bg-ink px-4 pt-2 pb-1.5 font-ui text-[12px] uppercase text-paper transition-colors hover:bg-blueberry-200/30 hover:text-ink md:text-[13px]">
            {uploading ? "Uploading…" : "Upload a photo"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={pending || uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setUploading(true);
                try {
                  const small = await shrinkImage(file);
                  const fd = new FormData();
                  fd.set("mode", "upload");
                  fd.set("file", small, "avatar.jpg");
                  run(updateAvatar, setAvatarResult, fd);
                } catch (err) {
                  setAvatarResult({ ok: false, error: err instanceof Error ? err.message : "Couldn't read that image" });
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
          <span className="font-body text-xs text-ink/55">Any photo from your phone or computer. It's cropped to a square and kept small.</span>
        </div>
        <Status result={avatarResult} />
      </section>

      <form
        className="space-y-5 border-t border-dashed border-ink/15 pt-10"
        onSubmit={(e) => {
          e.preventDefault();
          run(updateProfile, setProfileResult, new FormData(e.currentTarget));
        }}
      >
        <label className="block space-y-2">
          <FieldLabel>Display name</FieldLabel>
          <Input
            name="displayName"
            defaultValue={profile.displayName ?? ""}
            className={inputClass}
            placeholder="Your name"
          />
        </label>
        <label className="block space-y-2">
          <FieldLabel>Bio</FieldLabel>
          <Textarea
            name="bio"
            defaultValue={profile.bio ?? ""}
            rows={3}
            className="rounded-2xl border-ink/15 bg-white font-body text-base text-ink placeholder:text-ink/35 focus-visible:ring-lime"
            placeholder="What are you into?"
          />
        </label>
        <label className="block space-y-2">
          <FieldLabel>Portfolio URL</FieldLabel>
          <Input
            name="portfolioUrl"
            defaultValue={profile.portfolioUrl ?? ""}
            className={inputClass}
            placeholder="https://"
          />
        </label>
        <label className="block space-y-2">
          <FieldLabel>Phone (optional)</FieldLabel>
          <Input
            name="phone"
            type="tel"
            defaultValue={profile.phone ? formatPhone(profile.phone) : ""}
            className={inputClass}
            placeholder="(310) 555-0101"
          />
          <span className="block font-body text-xs text-ink/55">
            For texts about your carpool and last-minute changes. Shared with your car once a host confirms it.
          </span>
        </label>
        <div className="space-y-2">
          <FieldLabel>School</FieldLabel>
          <div>
            <PillToggle
              name="school"
              aria-label="School"
              value={school}
              onChange={setSchool}
              options={[
                { value: "USC", label: "USC" },
                { value: "UCLA", label: "UCLA" },
                { value: "other", label: "Neither / other" },
              ]}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button type="submit" variant="dark" size="md" disabled={pending}>
            Save profile
          </Button>
          <Status result={profileResult} />
        </div>
      </form>

      <section className="space-y-4 border-t border-dashed border-ink/15 pt-10">
        <div>
          <FieldLabel>Contact email</FieldLabel>
          <p className="mt-1 font-body text-sm text-ink/55">
            Used for RSVP and carpool notifications. Change this when you leave a school inbox.
          </p>
          <p className="mt-2 font-body text-base text-ink">
            {profile.contactEmail}
            {!profile.contactEmailVerified && (
              <span className="ml-2 text-sm text-ink/55">(unverified)</span>
            )}
          </p>
          {profile.pendingContactEmail && (
            <p className="mt-1 font-body text-sm text-ink/75">
              Pending verification: {profile.pendingContactEmail}
            </p>
          )}
        </div>
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(requestContactEmailChange, setEmailResult, new FormData(e.currentTarget));
          }}
        >
          <label className="block flex-1 space-y-2">
            <FieldLabel>New contact email</FieldLabel>
            <Input
              name="contactEmail"
              type="email"
              required
              className={inputClass}
              placeholder="you@gmail.com"
            />
          </label>
          <Button type="submit" variant="outline" size="md" disabled={pending}>
            Send verify link
          </Button>
        </form>
        <Status result={emailResult} />
      </section>

      <section className="space-y-4 border-t border-dashed border-ink/15 pt-10">
        <div>
          <FieldLabel>Luma guest email</FieldLabel>
          <p className="mt-1 font-body text-sm text-ink/55">
            Email you use (or used) when registering on Luma — for matching past attendance.
          </p>
        </div>
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(updateLumaEmail, setLumaResult, new FormData(e.currentTarget));
          }}
        >
          <label className="block flex-1 space-y-2">
            <FieldLabel>Luma email</FieldLabel>
            <Input
              name="lumaGuestEmail"
              type="email"
              required
              defaultValue={lumaGuestEmail}
              className={inputClass}
            />
          </label>
          <Button type="submit" variant="outline" size="md" disabled={pending}>
            Save
          </Button>
        </form>
        <Status result={lumaResult} />
      </section>

      <section className="space-y-5 border-t border-dashed border-ink/15 pt-10">
        <div>
          <FieldLabel>What you&apos;ve worked on</FieldLabel>
          <p className="mt-1 font-body text-sm text-ink/55">
            These prefills &quot;what are you working on&quot; when you RSVP.
          </p>
        </div>

        {demos.length === 0 ? (
          <p className="font-body text-sm text-ink/55">No demos yet.</p>
        ) : (
          <ul className="space-y-3">
            {demos.map((demo) => (
              <li
                key={demo.id}
                className="flex items-start justify-between gap-4 border-b border-dashed border-ink/10 pb-3"
              >
                <div>
                  <p className="font-body text-base text-ink">
                    {demo.title}
                  </p>
                  {demo.notes && (
                    <p className="font-body text-sm text-ink/55">
                      {demo.notes}
                    </p>
                  )}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(deleteDemo, setDemoResult, new FormData(e.currentTarget));
                  }}
                >
                  <input type="hidden" name="id" value={demo.id} />
                  <button
                    type="submit"
                    className="font-ui text-[10px] uppercase text-ink/55 hover:text-ink"
                    disabled={pending}
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            run(addDemo, setDemoResult, new FormData(form));
            form.reset();
          }}
        >
          <label className="block space-y-2">
            <FieldLabel>New demo title</FieldLabel>
            <Input name="title" required className={inputClass} placeholder="Project name" />
          </label>
          <label className="block space-y-2">
            <FieldLabel>Notes (optional)</FieldLabel>
            <Input name="notes" className={inputClass} placeholder="One-liner" />
          </label>
          <div className="flex items-center gap-4">
            <Button type="submit" variant="primary" size="md" disabled={pending}>
              Add demo
            </Button>
            <Status result={demoResult} />
          </div>
        </form>
      </section>
    </div>
  );
}
