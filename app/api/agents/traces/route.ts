import { NextResponse } from "next/server";
import { z } from "zod";

import { graphRagRepository } from "@/services/graph-rag-repository";
import { GraphRagTraceService } from "@/services/graph-rag-traces";

const traceListRequestSchema = z.object({
  ownerId: z.string().min(1).default("local-user"),
  organizationId: z.string().min(1).default("local-org"),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

const traceService = new GraphRagTraceService(graphRagRepository);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = traceListRequestSchema.parse({
    ownerId: url.searchParams.get("ownerId") ?? undefined,
    organizationId: url.searchParams.get("organizationId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  const runs = await traceService.list(parsed);

  return NextResponse.json({ runs });
}
