import type { Metadata } from "next";
import { TrustCenter } from "@/components/trust";

export const metadata: Metadata = { title: "Security · CampusPilot" };

export default function Page() {
  return <TrustCenter />;
}
