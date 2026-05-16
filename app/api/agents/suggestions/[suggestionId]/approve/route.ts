import { NextResponse } from "next/server";
import { z } from "zod";

import { graphRagRepository } from "@/services/graph-rag-repository";
import { GraphRagSuggestionService } from "@/services/graph-rag-suggestions";

const reviewSchema = z.object({
  reviewedBy: z.string().min(1).default("local-user"),
});

const suggestionService = new GraphRagSuggestionService(graphRagRepository);

export async function POST(request: Request, context: { params: Promise<{ suggestionId: string }> }) {
  const body = await request.json().catch(() => ({}));
  const parsed = reviewSchema.parse(body);
  const params = await context.params;
  const suggestion = await suggestionService.approve({
    suggestionId: params.suggestionId,
    reviewedBy: parsed.reviewedBy,
  });

  return NextResponse.json({ suggestion });
}
