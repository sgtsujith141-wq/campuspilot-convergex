import { cookies } from "next/headers";
import { AppShell } from "@/components/shell";
import { SampleLogin } from "@/components/login";
import { WorkspaceProvider } from "@/components/workspace";
import { getAppDb } from "@/lib/server/app";
import { resolveSessionInfo, SESSION_COOKIE } from "@/lib/server/session";
import { workspaceSnapshot } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const db = getAppDb();
  const session = resolveSessionInfo(db, (await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return <SampleLogin />;
  return (
    <WorkspaceProvider initial={workspaceSnapshot(db, session.studentId, session.expiresAt)}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
