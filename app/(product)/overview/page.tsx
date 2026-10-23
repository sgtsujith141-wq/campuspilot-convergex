import type { Metadata } from "next";
import { OverviewView } from "@/components/overview";

export const metadata: Metadata = { title: "Overview · CampusPilot" };

export default function Page() {
  return <OverviewView />;
}
