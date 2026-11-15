"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/actions/profile";

const MAX_BYTES = 1.5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Profile photo: upload a file, use the Google account photo, or remove it. */
export async function updateAvatar(formData: FormData): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
    const userId = session.user.id;
    const mode = String(formData.get("mode") || "");

    if (mode === "upload") {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a photo first" };
      if (!ALLOWED.has(file.type)) return { ok: false, error: "Use a JPG, PNG or WebP image" };
      if (file.size > MAX_BYTES) return { ok: false, error: "That photo is too large — try a smaller one" };
      const bytes = new Uint8Array(await file.arrayBuffer());
      await prisma.profile.update({
        where: { userId },
        data: {
          avatarData: bytes,
          avatarMime: file.type,
          avatarUrl: `/api/avatar/${userId}?v=${Date.now()}`,
        },
      });
    } else if (mode === "google") {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
      const image = user?.image || session.user.image || null;
      if (!image) return { ok: false, error: "Your Google account didn't share a photo. Sign in with Google once to pick it up." };
      await prisma.profile.update({ where: { userId }, data: { avatarUrl: image, avatarData: null, avatarMime: null } });
    } else if (mode === "remove") {
      await prisma.profile.update({ where: { userId }, data: { avatarUrl: null, avatarData: null, avatarMime: null } });
    } else {
      return { ok: false, error: "Unknown photo option" };
    }

    revalidatePath("/portal", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't update your photo" };
  }
}
