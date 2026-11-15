import Link from "next/link";
import { verifyContactEmail } from "@/lib/actions/profile";
import Eyebrow from "@/components/Eyebrow";
import Button from "@/components/Button";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }> | { token?: string };
}) {
  const params = await Promise.resolve(searchParams);
  const result = await verifyContactEmail(params.token || "");

  return (
    <div className="mx-auto max-w-md space-y-6 text-center">
      <Eyebrow className="font-ui text-blueberry">Email</Eyebrow>
      <h1 className="font-heading text-3xl lowercase text-ink">
        {result.ok ? "email confirmed" : "couldn't verify"}
      </h1>
      <p className="font-body text-base text-ink/75">
        {result.ok
          ? "Your contact email is updated. RSVP and carpool notices will go here."
          : result.error}
      </p>
      <Button href="/portal/profile" variant="dark" size="md">
        Back to profile
      </Button>
      <div>
        <Link
          href="/portal"
          className="font-ui text-[11px] uppercase text-ink/55 hover:text-ink"
        >
          Portal home
        </Link>
      </div>
    </div>
  );
}
