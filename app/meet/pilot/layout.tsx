import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { loopbackHostOrigin, pilotEnabled } from "@/lib/community/pilot/access";
import "@/styles/community.css";
import "@/styles/community-pilot.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sundays · Introductions", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function PilotLayout({ children }: { children: React.ReactNode }) {
  if (!pilotEnabled()) notFound();
  const host = headers().get("host");
  if (!host || !loopbackHostOrigin(host)) notFound();
  return (
    <main className="meet-surface meet-page">
      <header className="meet-header pilot-header"><Link className="meet-brand" href="/" aria-label="Sundays home"><img src="/smiley.png" width={32} height={32} alt="" /><span>SUNDAYS IN LA</span></Link></header>
      {children}
    </main>
  );
}
