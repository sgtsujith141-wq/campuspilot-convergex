import type { Metadata } from "next";
import { DecisionStudio } from "@/components/decisions";

export const metadata: Metadata = { title: "Decisions · CampusPilot" };

export default function Page() {
  return <DecisionStudio />;
}
