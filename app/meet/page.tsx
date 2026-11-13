import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import DiscoveryExperience from "@/components/community/DiscoveryExperience";
import { demoEnabled } from "@/lib/community/http";
import { DEMO_MEMBERS, DEMO_SESSION, DEMO_VIEWER } from "@/lib/community/fixtures";
import { discover } from "@/lib/community/discovery";
import { toViewerProfile } from "@/lib/community/schemas";
import { loopbackHostOrigin, pilotEnabled } from "@/lib/community/pilot/access";
import { matchLocally } from "@/lib/community/pilot/local-matching";
import { sampleDirectory } from "@/lib/community/pilot/sample";
import MeetRoom from "@/components/community/pilot/MeetRoom";
import "@/styles/community.css";
import "@/styles/community-pilot.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "You should meet · Sundays in LA",
  description: "A few good introductions through what you make and care about.",
  robots: { index: false, follow: false },
};

export default async function MeetPage() {
  if (pilotEnabled()) {
    const host = headers().get("host");
    if (!host || !loopbackHostOrigin(host)) notFound();
    const live = process.env.COMMUNITY_PILOT_LIVE === "true";
    const initialResult = live ? null : await matchLocally(matcher => sampleDirectory("", Date.now(), matcher), process.env);
    return <main className="meet-surface meet-page room-page">
      <header className="meet-header room-header">
        <Link className="meet-brand" href="/" aria-label="Sundays home">
          <img src="/smiley.png" width={32} height={32} alt="" />
          <span>SUNDAYS IN LA</span>
        </Link>
      </header>
      <MeetRoom initialResult={initialResult} live={live} />
    </main>;
  }
  if (!demoEnabled()) notFound();
  const initialResult = discover(DEMO_MEMBERS, DEMO_VIEWER, { scope: "today", sessionId: DEMO_SESSION.id });
  return <DiscoveryExperience initialViewer={toViewerProfile(DEMO_VIEWER)} initialResult={initialResult} liveImportEnabled={process.env.NODE_ENV !== "production" && process.env.COMMUNITY_GITHUB_IMPORT_ENABLED === "true"} />;
}
