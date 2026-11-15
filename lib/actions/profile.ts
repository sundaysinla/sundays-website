"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ensureProfile } from "@/lib/profile";
import { sendEmail } from "@/lib/email";
import { normalizePhone } from "@/lib/phone";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await ensureProfile(userId);

    const displayName = String(formData.get("displayName") || "").trim() || null;
    const bio = String(formData.get("bio") || "").trim() || null;
    const portfolioUrl = String(formData.get("portfolioUrl") || "").trim() || null;
    const school = String(formData.get("school") || "").trim() || null;
    const phoneRaw = String(formData.get("phone") || "").trim();
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;

    if (portfolioUrl && !/^https?:\/\//i.test(portfolioUrl)) {
      return { ok: false, error: "Portfolio URL must start with http:// or https://" };
    }
    if (phoneRaw && !phone) {
      return { ok: false, error: "That phone number doesn't look right — use 10 digits, or +country code" };
    }

    await prisma.profile.update({
      where: { userId },
      data: { displayName, bio, portfolioUrl, school, phone },
    });

    revalidatePath("/portal");
    revalidatePath("/portal/profile");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update profile" };
  }
}

export async function requestContactEmailChange(
  formData: FormData
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const profile = await ensureProfile(userId);
    const newEmail = String(formData.get("contactEmail") || "").trim().toLowerCase();

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return { ok: false, error: "Enter a valid email address" };
    }

    if (newEmail === profile.contactEmail.toLowerCase()) {
      return { ok: false, error: "That's already your contact email" };
    }

    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.profile.update({
      where: { userId },
      data: {
        pendingContactEmail: newEmail,
        pendingContactEmailToken: token,
        pendingContactEmailExpires: expires,
      },
    });

    const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:4000";
    const verifyUrl = `${baseUrl}/portal/profile/verify-email?token=${token}`;

    await sendEmail({
      to: newEmail,
      subject: "Confirm your Sundays contact email",
      html: `
        <p>Hey — confirm this email for your Sundays in LA profile.</p>
        <p><a href="${verifyUrl}">Verify contact email</a></p>
        <p>This link expires in 1 hour.</p>
      `,
    });

    revalidatePath("/portal/profile");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to start email change" };
  }
}

export async function verifyContactEmail(token: string): Promise<ActionResult> {
  try {
    if (!token) return { ok: false, error: "Missing token" };

    const profile = await prisma.profile.findFirst({
      where: {
        pendingContactEmailToken: token,
        pendingContactEmailExpires: { gt: new Date() },
      },
    });

    if (!profile?.pendingContactEmail) {
      return { ok: false, error: "Invalid or expired verification link" };
    }

    await prisma.$transaction([
      prisma.profile.update({
        where: { id: profile.id },
        data: {
          contactEmail: profile.pendingContactEmail,
          contactEmailVerified: true,
          pendingContactEmail: null,
          pendingContactEmailToken: null,
          pendingContactEmailExpires: null,
        },
      }),
      prisma.lumaLink.upsert({
        where: { userId: profile.userId },
        create: {
          userId: profile.userId,
          lumaGuestEmail: profile.pendingContactEmail,
        },
        update: {
          lumaGuestEmail: profile.pendingContactEmail,
        },
      }),
    ]);

    revalidatePath("/portal");
    revalidatePath("/portal/profile");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Verification failed" };
  }
}

export async function addDemo(formData: FormData): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const title = String(formData.get("title") || "").trim();
    const notes = String(formData.get("notes") || "").trim() || null;

    if (!title) return { ok: false, error: "Title is required" };

    await prisma.demoHistory.create({
      data: { userId, title, notes },
    });

    revalidatePath("/portal");
    revalidatePath("/portal/profile");
    revalidatePath("/portal/rsvp");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to add demo" };
  }
}

export async function deleteDemo(formData: FormData): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const id = String(formData.get("id") || "");
    if (!id) return { ok: false, error: "Missing demo id" };

    const demo = await prisma.demoHistory.findFirst({ where: { id, userId } });
    if (!demo) return { ok: false, error: "Demo not found" };

    await prisma.demoHistory.delete({ where: { id } });
    revalidatePath("/portal");
    revalidatePath("/portal/profile");
    revalidatePath("/portal/rsvp");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete demo" };
  }
}

export async function updateLumaEmail(formData: FormData): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const lumaGuestEmail = String(formData.get("lumaGuestEmail") || "")
      .trim()
      .toLowerCase();

    if (!lumaGuestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lumaGuestEmail)) {
      return { ok: false, error: "Enter a valid Luma email" };
    }

    await prisma.lumaLink.upsert({
      where: { userId },
      create: { userId, lumaGuestEmail },
      update: { lumaGuestEmail },
    });

    revalidatePath("/portal/profile");
    revalidatePath("/portal/rsvp");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update Luma email" };
  }
}
