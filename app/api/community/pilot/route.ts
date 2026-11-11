import { handlePilot } from "@/lib/community/pilot/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handlePilot(request);
}
