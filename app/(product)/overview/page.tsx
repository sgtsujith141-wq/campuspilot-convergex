import type { Metadata } from "next";
import { OverviewView } from "@/components/overview";

export const metadata: Metadata = { title: "Home · CampusPilot" };

export default function Page() {
  return <OverviewView />;
}
