import { notFound } from "next/navigation";
import HostPanel from "@/components/community/pilot/HostPanel";

export default function PilotHostPage() {
  if ((process.env.COMMUNITY_PILOT_HOST_KEY?.length ?? 0) < 32) notFound();
  return <HostPanel />;
}
