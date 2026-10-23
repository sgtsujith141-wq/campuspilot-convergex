import type { Metadata } from "next";
import { Intro } from "@/components/intro";
import { OverviewView } from "@/components/overview";

export const metadata: Metadata = { title: "Home · CampusPilot" };

// /overview?intro=1 plays the presentation opening over the real Home screen (server-rendered,
// so Home never flashes first). Normal navigation never shows it.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { intro } = await searchParams;
  return (
    <>
      {intro === "1" && <Intro />}
      <OverviewView />
    </>
  );
}
