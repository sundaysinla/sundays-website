import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Serves an uploaded profile photo. The URL carries a version query, so it can be cached hard. */
export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  const profile = await prisma.profile.findUnique({
    where: { userId: params.userId },
    select: { avatarData: true, avatarMime: true },
  });
  if (!profile?.avatarData || !profile.avatarMime) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(Buffer.from(profile.avatarData), {
    headers: {
      "Content-Type": profile.avatarMime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
