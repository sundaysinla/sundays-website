import { NextResponse } from "next/server";
import { getProjectImageUrl } from "@/lib/notion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = {
  params: Promise<{ pageId: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const { pageId } = await params;
    const imageUrl = await getProjectImageUrl(decodeURIComponent(pageId));
    if (!imageUrl) {
      return new NextResponse("Project image not found", { status: 404 });
    }

    const response = await fetch(imageUrl, { cache: "no-store" });
    if (!response.ok || !response.body) {
      return new NextResponse("Project image unavailable", { status: 502 });
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Failed to proxy project image:", error);
    return new NextResponse("Project image unavailable", { status: 500 });
  }
}
