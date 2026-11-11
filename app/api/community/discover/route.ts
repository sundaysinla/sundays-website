import { handleDiscovery } from "@/lib/community/handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) { return handleDiscovery(request); }
