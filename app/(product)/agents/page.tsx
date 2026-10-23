import type { Metadata } from "next";
import { AgentActivity } from "@/components/agents";

export const metadata: Metadata = { title: "Activity · CampusPilot" };

export default function Page() {
  return <AgentActivity />;
}
