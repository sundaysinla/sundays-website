import type { Metadata } from "next";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin";
import AuthProvider from "@/components/portal/AuthProvider";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Members · Sundays in LA",
  description: "Your Sundays membership portal — profile, RSVP, and carpool.",
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  let profile: { displayName: string | null; avatarUrl: string | null } | null = null;
  if (session?.user?.id) {
    try {
      profile = await prisma.profile.findUnique({
        where: { userId: session.user.id },
        select: { displayName: true, avatarUrl: true },
      });
    } catch {
      profile = null;
    }
  }

  const portal = session?.user
    ? {
        name: profile?.displayName || session.user.name || null,
        image: profile?.avatarUrl || session.user.image || null,
        email: session.user.email ?? null,
        isAdmin: isAdminEmail(session.user.email),
        signOut: signOutAction,
      }
    : null;

  return (
    <AuthProvider>
      <div className="relative min-h-screen overflow-x-clip bg-paper font-body text-ink/85">
        <NavBar portal={portal} />
        <main className="mx-auto w-full max-w-[1280px] px-6 pt-8 pb-24 md:px-12 md:pt-12">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
