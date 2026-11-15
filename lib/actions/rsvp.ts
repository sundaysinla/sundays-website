"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ensureProfile } from "@/lib/profile";
import { addGuest, LumaError } from "@/lib/luma";
import {
  findWorkingOnQuestion,
  getUpcomingCachedEvent,
  syncUpcomingEvents,
  syncUserAttendance,
} from "@/lib/luma-sync";
import { checkRateLimit } from "@/lib/rate-limit";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function refreshLumaData(): Promise<
  (ActionResult & { matched?: number }) | { ok: false; error: string }
> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

    await syncUpcomingEvents({ force: true });
    const { matched } = await syncUserAttendance(session.user.id);
    revalidatePath("/portal");
    revalidatePath("/portal/rsvp");
    revalidatePath("/portal/carpool");
    return { ok: true, matched };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to sync Luma",
    };
  }
}

export async function oneClickRsvp(formData: FormData): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Unauthorized" };

    const limited = checkRateLimit(`rsvp:${session.user.id}`, 5, 60_000);
    if (!limited.ok) {
      return { ok: false, error: "Too many RSVP attempts — try again in a minute." };
    }

    const profile = await ensureProfile(session.user.id, session.user);
    const lumaLink = await prisma.lumaLink.findUnique({
      where: { userId: session.user.id },
    });

    await syncUpcomingEvents();
    let event = await getUpcomingCachedEvent();
    if (!event) {
      return {
        ok: false,
        error: "No upcoming Sundays event found. Try opening Luma directly.",
      };
    }

    // Refresh questions if stale/empty
    if (
      !event.registrationQuestions ||
      (Array.isArray(event.registrationQuestions) &&
        event.registrationQuestions.length === 0)
    ) {
      await syncUpcomingEvents();
      event = (await getUpcomingCachedEvent()) || event;
    }

    const workingOn = String(formData.get("workingOn") || "").trim();
    const customWorkingOn = String(formData.get("customWorkingOn") || "").trim();
    const answerText = customWorkingOn || workingOn;

    if (!answerText) {
      return { ok: false, error: "Tell us what you're working on" };
    }

    const questions = (event.registrationQuestions as
      | { id?: string; label?: string }[]
      | null) || [];
    const question = findWorkingOnQuestion(questions);

    const registrationAnswers = question?.id
      ? [{ question_id: question.id, value: answerText }]
      : undefined;

    const email = (lumaLink?.lumaGuestEmail || profile.contactEmail).toLowerCase();
    const name = profile.displayName || session.user.name || undefined;

    const existing = await prisma.attendance.findUnique({
      where: {
        userId_lumaEventId: {
          userId: session.user.id,
          lumaEventId: event.lumaEventId,
        },
      },
    });

    if (existing && (existing.status === "going" || existing.status === "approved")) {
      return { ok: false, error: "You're already registered for this week." };
    }

    try {
      await addGuest({
        eventId: event.lumaEventId,
        email,
        name,
        registrationAnswers,
        approvalStatus: "approved",
      });
    } catch (e) {
      if (e instanceof LumaError) {
        return {
          ok: false,
          error: `Luma registration failed: ${e.message}. You can still RSVP on Luma.`,
        };
      }
      throw e;
    }

    await prisma.attendance.upsert({
      where: {
        userId_lumaEventId: {
          userId: session.user.id,
          lumaEventId: event.lumaEventId,
        },
      },
      create: {
        userId: session.user.id,
        lumaEventId: event.lumaEventId,
        status: "going",
        registrationAnswers: registrationAnswers
          ? { workingOn: answerText, answers: registrationAnswers }
          : { workingOn: answerText },
      },
      update: {
        status: "going",
        registrationAnswers: registrationAnswers
          ? { workingOn: answerText, answers: registrationAnswers }
          : { workingOn: answerText },
      },
    });

    // Persist demo history if new
    const existingDemo = await prisma.demoHistory.findFirst({
      where: {
        userId: session.user.id,
        title: { equals: answerText, mode: "insensitive" },
      },
    });
    if (!existingDemo) {
      await prisma.demoHistory.create({
        data: {
          userId: session.user.id,
          title: answerText,
          eventId: event.lumaEventId,
        },
      });
    }

    revalidatePath("/portal");
    revalidatePath("/portal/rsvp");
    revalidatePath("/portal/profile");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "RSVP failed",
    };
  }
}
