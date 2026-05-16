import { NextResponse } from "next/server";
import { z } from "zod";

import { graphSuggestionStatusSchema } from "@/schemas/graph-rag";
import { graphRagRepository } from "@/services/graph-rag-repository";
import { GraphRagSuggestionService } from "@/services/graph-rag-suggestions";

const scopeSchema = z.object({
  ownerId: z.string().min(1).default("local-user"),
  organizationId: z.string().min(1).default("local-org"),
  status: graphSuggestionStatusSchema.default("pending"),
});

const proposeSchema = z.object({
  ownerId: z.string().min(1).default("local-user"),
  organizationId: z.string().min(1).default("local-org"),
  limit: z.number().int().positive().max(20).default(8),
});

const suggestionService = new GraphRagSuggestionService(graphRagRepository);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = scopeSchema.parse({
    ownerId: url.searchParams.get("ownerId") ?? undefined,
    organizationId: url.searchParams.get("organizationId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
  const suggestions = await suggestionService.list(parsed.ownerId, parsed.organizationId, parsed.status);

  return NextResponse.json({ suggestions });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = proposeSchema.parse(body);
  const suggestions = await suggestionService.propose(parsed);

  return NextResponse.json({ suggestions });
}
