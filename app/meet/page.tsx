import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import DiscoveryExperience from "@/components/community/DiscoveryExperience";
import { demoEnabled } from "@/lib/community/http";
import { DEMO_MEMBERS, DEMO_SESSION, DEMO_VIEWER } from "@/lib/community/fixtures";
import { discover } from "@/lib/community/discovery";
import { toViewerProfile } from "@/lib/community/schemas";
import { pilotEnabled } from "@/lib/community/pilot/access";
import "@/styles/community.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "You should meet · Sundays in LA",
  description: "A few good introductions through what you make and care about.",
  robots: { index: false, follow: false },
};

export default function MeetPage() {
  if (pilotEnabled()) redirect("/meet/pilot");
  if (!demoEnabled()) notFound();
  const initialResult = discover(DEMO_MEMBERS, DEMO_VIEWER, { scope: "today", sessionId: DEMO_SESSION.id });
  return <DiscoveryExperience initialViewer={toViewerProfile(DEMO_VIEWER)} initialResult={initialResult} liveImportEnabled={process.env.NODE_ENV !== "production" && process.env.COMMUNITY_GITHUB_IMPORT_ENABLED === "true"} />;
}
