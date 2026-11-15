import { prisma } from "@/lib/db";
import { claimGuestOffers } from "@/lib/carpool/service";

type SessionUser = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export async function ensureProfile(userId: string, sessionUser?: SessionUser) {
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (existing) return existing;

  const email =
    sessionUser?.email ||
    (await prisma.user.findUnique({ where: { id: userId } }))?.email;

  if (!email) {
    throw new Error("Cannot create profile without an email");
  }

  const [profile] = await prisma.$transaction([
    prisma.profile.create({
      data: {
        userId,
        displayName: sessionUser?.name ?? null,
        contactEmail: email,
        contactEmailVerified: true,
        avatarUrl: sessionUser?.image ?? null,
      },
    }),
    prisma.lumaLink.upsert({
      where: { userId },
      create: { userId, lumaGuestEmail: email },
      update: {},
    }),
  ]);

  // Hosts may have written this person into a carpool before they signed up.
  try {
    await claimGuestOffers(userId, email);
  } catch (e) {
    console.warn("[profile] claiming guest carpool offers failed", e);
  }

  return profile;
}

export async function getProfileForUser(userId: string) {
  return prisma.profile.findUnique({ where: { userId } });
}
