import type { Metadata } from "next";
import { AgentActivity } from "@/components/agents";

export const metadata: Metadata = { title: "Agent activity · CampusPilot" };

export default function Page() {
  return <AgentActivity />;
}
