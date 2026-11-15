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
      <Eyebrow>Email</Eyebrow>
      <h1 className="font-['Office-Times-Sharp-Regular'] text-3xl lowercase text-[#010101]">
        {result.ok ? "email confirmed" : "couldn't verify"}
      </h1>
      <p className="font-['Office-Times-Round'] text-base text-[#3A372F]">
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
          className="font-['Monument-Grotesk'] text-[11px] uppercase text-[#C0B9A5] hover:text-[#8a8478]"
        >
          Portal home
        </Link>
      </div>
    </div>
  );
}
