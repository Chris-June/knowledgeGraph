import {
  retrievalContextSchema,
  type DocumentChunk,
  type RagGraphEdge,
  type RetrievalContext,
  type RetrievalRun,
} from "@/schemas/graph-rag";

import type { GraphRagRepository } from "./graph-rag-repository";

type RetrievalInput = {
  query: string;
  ownerId: string;
  organizationId: string;
  maxChunks?: number;
  maxHops?: number;
};

function tokenize(text: string) {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2),
  );
}

function lexicalScore(query: string, text: string) {
  const queryTokens = tokenize(query);
  const textTokens = tokenize(text);

  if (queryTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  queryTokens.forEach((token) => {
    if (textTokens.has(token)) {
      overlap += 1;
    }
  });

  return overlap / queryTokens.size;
}

function edgeScore(edge: RagGraphEdge, distance: number) {
  return Math.max(0, edge.confidence - distance * 0.12);
}

function nowId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class GraphRagRetrievalService {
  constructor(private readonly repository: GraphRagRepository) {}

  async retrieve(input: RetrievalInput): Promise<RetrievalContext> {
    const maxChunks = input.maxChunks ?? 5;
    const maxHops = input.maxHops ?? 2;
    const snapshot = await this.repository.getSnapshot(input.ownerId, input.organizationId);
    const chunkScores = snapshot.chunks
      .filter((chunk) => chunk.visible)
      .map((chunk) => ({
        chunk,
        score: lexicalScore(input.query, chunk.text),
        reasons: ["lexical_chunk_match"],
      }))
      .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id));

    const selectedChunks = chunkScores.some((row) => row.score > 0)
      ? chunkScores.filter((row) => row.score > 0).slice(0, maxChunks)
      : chunkScores.slice(0, Math.min(3, maxChunks)).map((row) => ({ ...row, reasons: ["fallback_seed_context"] }));
    const selectedChunksForContext = selectedChunks.map((row) => ({
      ...row,
      chunk: stripEmbedding(row.chunk),
    }));

    const selectedChunkIds = new Set(selectedChunks.map((row) => row.chunk.id));
    const startNodeIds = new Set(
      snapshot.nodes
        .filter((node) => node.kind === "chunk" && node.chunkId && selectedChunkIds.has(node.chunkId))
        .map((node) => node.id),
    );

    const visited = new Map<string, number>();
    const queue = Array.from(startNodeIds).map((nodeId) => ({ nodeId, distance: 0 }));

    while (queue.length > 0) {
      const current = queue.shift();

      if (!current || current.distance > maxHops || visited.has(current.nodeId)) {
        continue;
      }

      visited.set(current.nodeId, current.distance);

      snapshot.edges
        .filter((edge) => edge.sourceNodeId === current.nodeId || edge.targetNodeId === current.nodeId)
        .forEach((edge) => {
          const nextNodeId = edge.sourceNodeId === current.nodeId ? edge.targetNodeId : edge.sourceNodeId;
          if (!visited.has(nextNodeId)) {
            queue.push({ nodeId: nextNodeId, distance: current.distance + 1 });
          }
        });
    }

    const retrievedNodes = Array.from(visited.entries())
      .map(([nodeId, distance]) => {
        const node = snapshot.nodes.find((candidate) => candidate.id === nodeId);
        return node ? { node, distance, score: Math.max(0, 1 - distance * 0.18) * node.confidence } : null;
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => b.score - a.score);

    const retrievedNodeIds = new Set(retrievedNodes.map((row) => row.node.id));
    const retrievedEdges = snapshot.edges
      .filter((edge) => retrievedNodeIds.has(edge.sourceNodeId) && retrievedNodeIds.has(edge.targetNodeId))
      .map((edge) => ({
        edge,
        score: edgeScore(edge, Math.min(visited.get(edge.sourceNodeId) ?? maxHops, visited.get(edge.targetNodeId) ?? maxHops)),
      }))
      .sort((a, b) => b.score - a.score);

    const citations = selectedChunks.map((row) => ({
      chunkId: row.chunk.id,
      documentId: row.chunk.documentId,
      label: labelForChunk(row.chunk),
      sourceSpan: row.chunk.sourceSpan,
      quote: row.chunk.text,
    }));

    const confidence = Math.min(
      1,
      Math.max(0.2, selectedChunks.reduce((sum, row) => sum + row.score, 0) / Math.max(selectedChunks.length, 1) + retrievedEdges.length * 0.025),
    );

    const context = retrievalContextSchema.parse({
      query: input.query,
      strategy: "local_graph",
      chunks: selectedChunksForContext,
      nodes: retrievedNodes,
      edges: retrievedEdges,
      citations,
      coverageNotes:
        selectedChunks[0]?.score === 0
          ? ["No direct lexical match was found; seed context was returned for exploration."]
          : ["Retrieved chunk nodes and expanded graph context within two hops."],
      confidence,
    });

    const run: RetrievalRun = {
      id: nowId("retrieval"),
      ownerId: input.ownerId,
      organizationId: input.organizationId,
      query: input.query,
      strategy: context.strategy,
      retrievedNodeIds: context.nodes.map((row) => row.node.id),
      retrievedChunkIds: context.chunks.map((row) => row.chunk.id),
      confidence: context.confidence,
      citations: context.citations,
      createdAt: new Date().toISOString(),
    };

    await this.repository.saveRetrievalRun(run);
    return context;
  }
}

function labelForChunk(chunk: DocumentChunk) {
  return chunk.text.split(".")[0] ?? chunk.id;
}

function stripEmbedding(chunk: DocumentChunk) {
  return {
    id: chunk.id,
    documentId: chunk.documentId,
    ownerId: chunk.ownerId,
    organizationId: chunk.organizationId,
    text: chunk.text,
    tokenCount: chunk.tokenCount,
    sourceSpan: chunk.sourceSpan,
    visible: chunk.visible,
    version: chunk.version,
    createdAt: chunk.createdAt,
  };
}
