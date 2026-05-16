import { NextResponse } from "next/server";
import { z } from "zod";

import { graphRagRepository } from "@/services/graph-rag-repository";
import { GraphRagTraceService } from "@/services/graph-rag-traces";

const traceDetailRequestSchema = z.object({
  runId: z.string().min(1),
  ownerId: z.string().min(1).default("local-user"),
  organizationId: z.string().min(1).default("local-org"),
});

const traceService = new GraphRagTraceService(graphRagRepository);

export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const url = new URL(request.url);
  const { runId } = await params;
  const parsed = traceDetailRequestSchema.parse({
    runId,
    ownerId: url.searchParams.get("ownerId") ?? undefined,
    organizationId: url.searchParams.get("organizationId") ?? undefined,
  });
  const trace = await traceService.get(parsed);

  if (!trace) {
    return NextResponse.json({ error: "Retrieval trace not found" }, { status: 404 });
  }

  return NextResponse.json({ trace });
}
