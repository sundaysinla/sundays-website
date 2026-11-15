import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ensureProfile } from "@/lib/profile";
import Eyebrow from "@/components/Eyebrow";
import ProfileForms from "@/components/portal/ProfileForms";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/portal/login");

  const profile = await ensureProfile(session.user.id, session.user);
  const [demos, lumaLink, user] = await Promise.all([
    prisma.demoHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lumaLink.findUnique({ where: { userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { image: true } }),
  ]);

  return (
    <div className="max-w-2xl space-y-8">
      <section className="space-y-3">
        <Eyebrow>Profile</Eyebrow>
        <h1 className="font-['Office-Times-Sharp-Regular'] text-3xl lowercase text-[#010101] md:text-4xl">
          your details
        </h1>
        <p className="max-w-md font-['Office-Times-Round'] text-base text-[#3A372F]">
          Portfolio, contact email, and the projects you&apos;ve demoed at Sundays.
        </p>
      </section>

      <ProfileForms
        profile={{
          displayName: profile.displayName,
          bio: profile.bio,
          portfolioUrl: profile.portfolioUrl,
          school: profile.school,
          phone: profile.phone,
          contactEmail: profile.contactEmail,
          contactEmailVerified: profile.contactEmailVerified,
          pendingContactEmail: profile.pendingContactEmail,
        }}
        demos={demos.map((d) => ({ id: d.id, title: d.title, notes: d.notes }))}
        lumaGuestEmail={lumaLink?.lumaGuestEmail ?? profile.contactEmail}
        avatarUrl={profile.avatarUrl}
        googleImage={user?.image ?? session.user.image ?? null}
      />
    </div>
  );
}
