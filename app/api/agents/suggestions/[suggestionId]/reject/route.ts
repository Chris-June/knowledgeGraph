import { NextResponse } from "next/server";
import { z } from "zod";

import { graphRagRepository } from "@/services/graph-rag-repository";
import { GraphRagSuggestionService } from "@/services/graph-rag-suggestions";

const rejectSchema = z.object({
  reviewedBy: z.string().min(1).default("local-user"),
  rejectionReason: z.string().optional(),
});

const suggestionService = new GraphRagSuggestionService(graphRagRepository);

export async function POST(request: Request, context: { params: Promise<{ suggestionId: string }> }) {
  const body = await request.json().catch(() => ({}));
  const parsed = rejectSchema.parse(body);
  const params = await context.params;
  const suggestion = await suggestionService.reject({
    suggestionId: params.suggestionId,
    reviewedBy: parsed.reviewedBy,
    rejectionReason: parsed.rejectionReason,
  });

  return NextResponse.json({ suggestion });
}
