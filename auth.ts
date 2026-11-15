import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { claimGuestOffers } from "@/lib/carpool/service";
import { claimGuestAttendance } from "@/lib/attendance";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  // Resend/email MUST sit next to the adapter (not in Edge auth.config)
  providers: [
    ...authConfig.providers,
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY || process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM || "Sundays in LA <onboarding@resend.dev>",
    }),
  ],
  events: {
    // Google shares a photo on every sign-in; keep the account photo current and
    // use it as the profile photo unless the member picked their own.
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" || !user.id) return;
      const picture = typeof profile?.picture === "string" ? profile.picture : null;
      if (!picture) return;
      try {
        await prisma.user.update({ where: { id: user.id }, data: { image: picture } });
        await prisma.profile.updateMany({
          where: { userId: user.id, avatarUrl: null },
          data: { avatarUrl: picture },
        });
      } catch (e) {
        console.warn("[auth] google photo sync failed", e);
      }
    },
    async createUser({ user }) {
      if (!user.id || !user.email) return;
      try {
        await prisma.profile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            displayName: user.name ?? null,
            contactEmail: user.email,
            contactEmailVerified: true,
            avatarUrl: user.image ?? null,
          },
          update: {},
        });
        await prisma.lumaLink.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            lumaGuestEmail: user.email,
          },
          update: {},
        });
        await claimGuestOffers(user.id, user.email);
        await claimGuestAttendance(user.id, user.email);
      } catch (e) {
        console.error("[auth] createUser profile bootstrap failed", e);
      }
    },
  },
});
