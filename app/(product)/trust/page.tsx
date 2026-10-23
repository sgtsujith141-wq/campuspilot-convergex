import type { Metadata } from "next";
import { TrustCenter } from "@/components/trust";

export const metadata: Metadata = { title: "Trust center · CampusPilot" };

export default function Page() {
  return <TrustCenter />;
}
