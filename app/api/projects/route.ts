import { NextResponse } from "next/server";
import { getProjects } from "@/lib/notion";

export const revalidate = 60;

export async function GET() {
  const projects = await getProjects();
  return NextResponse.json(projects, {
    headers: {
      "Cache-Control": "public, no-cache, s-maxage=60, stale-while-revalidate=30",
    },
  });
}
