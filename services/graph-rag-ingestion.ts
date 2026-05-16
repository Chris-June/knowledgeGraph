import { createHash } from "node:crypto";

import type { DocumentChunk, DocumentRecord, ImportRun } from "@/schemas/graph-rag";

export type ChunkDocumentInput = {
  title: string;
  text: string;
  ownerId: string;
  organizationId: string;
  sourceType?: DocumentRecord["sourceType"];
  maxCharacters?: number;
};

export type ChunkDocumentResult = {
  document: DocumentRecord;
  chunks: DocumentChunk[];
  importRun: ImportRun;
};

export function makeEmbeddingSeed(text: string) {
  return Array.from({ length: 1536 }, (_, index) => {
    const code = text.charCodeAt(index % Math.max(text.length, 1)) || 0;
    return ((code + index * 17) % 1000) / 1000;
  });
}

export function chunkDocument(input: ChunkDocumentInput): ChunkDocumentResult {
  const now = new Date().toISOString();
  const maxCharacters = input.maxCharacters ?? 900;
  const checksum = createHash("sha256").update(input.text).digest("hex");
  const documentId = `doc_${checksum.slice(0, 16)}`;
  const importRunId = `import_${checksum.slice(0, 16)}`;
  const paragraphs = input.text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const rawChunks = paragraphs.length > 0 ? paragraphs : [input.text.trim()];
  const chunks: DocumentChunk[] = [];

  rawChunks.forEach((rawChunk, index) => {
    let cursor = 0;

    while (cursor < rawChunk.length) {
      const text = rawChunk.slice(cursor, cursor + maxCharacters).trim();
      if (text) {
        chunks.push({
          id: `chunk_${checksum.slice(0, 10)}_${index}_${chunks.length}`,
          documentId,
          ownerId: input.ownerId,
          organizationId: input.organizationId,
          text,
          tokenCount: Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.35)),
          sourceSpan: { start: cursor, end: cursor + text.length },
          embedding: makeEmbeddingSeed(text),
          visible: true,
          version: 1,
          createdAt: now,
        });
      }
      cursor += maxCharacters;
    }
  });

  return {
    document: {
      id: documentId,
      ownerId: input.ownerId,
      organizationId: input.organizationId,
      title: input.title,
      sourceType: input.sourceType ?? "text",
      checksum,
      status: "ready",
      createdAt: now,
      updatedAt: now,
    },
    chunks,
    importRun: {
      id: importRunId,
      ownerId: input.ownerId,
      organizationId: input.organizationId,
      status: "ready",
      createdAt: now,
      updatedAt: now,
    },
  };
}
