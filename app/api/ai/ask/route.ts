import type { NextRequest } from "next/server";
import { z } from "zod";
import { runAsk } from "@/lib/ai/agent";
import { MAX_QUESTION_CHARS } from "@/lib/ai/intent";
import { getLocalProvider } from "@/lib/ai/local-provider";
import { json, readBody, withStudent } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const AskSchema = z.object({ question: z.string().trim().min(1).max(MAX_QUESTION_CHARS) }).strict();

// The student is taken from the session; the body carries only the question.
export async function POST(req: NextRequest) {
  return withStudent(
    req,
    async ({ db, studentId }) => {
      const { question } = await readBody(req, AskSchema);
      return json(await runAsk(db, studentId, question, getLocalProvider()));
    },
    { mutation: true },
  );
}
