import { NextResponse } from "next/server";
import { z } from "zod";

import { chunkDocument } from "@/services/graph-rag-ingestion";
import { graphRagRepository } from "@/services/graph-rag-repository";

const ingestRequestSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  ownerId: z.string().min(1).default("local-user"),
  organizationId: z.string().min(1).default("local-org"),
  sourceType: z.enum(["text", "markdown", "pdf", "url", "upload"]).default("text"),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = ingestRequestSchema.parse(body);
  const chunked = chunkDocument(parsed);
  const persisted = await graphRagRepository.saveImportedDocument(chunked);

  return NextResponse.json({
    document: persisted.document,
    chunkCount: persisted.chunks.length,
    importRun: persisted.importRun,
  });
}
