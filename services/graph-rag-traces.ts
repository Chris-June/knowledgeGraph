import {
  retrievalTraceSchema,
  type AgentMemory,
  type GraphTracePathStep,
  type RetrievalContext,
  type RetrievalRun,
  type RetrievalTrace,
  type ToolExecution,
} from "@/schemas/graph-rag";

import type { GraphRagRepository, GraphRagSnapshot } from "./graph-rag-repository";

export class GraphRagTraceService {
  constructor(private readonly repository: GraphRagRepository) {}

  async list(input: { ownerId: string; organizationId: string; limit?: number }) {
    return this.repository.listRetrievalRuns(input.ownerId, input.organizationId, input.limit ?? 8);
  }

  async get(input: { runId: string; ownerId: string; organizationId: string }): Promise<RetrievalTrace | null> {
    const run = await this.repository.getRetrievalRun(input.runId, input.ownerId, input.organizationId);

    if (!run) {
      return null;
    }

    const [snapshot, toolExecutions] = await Promise.all([
      this.repository.getSnapshot(input.ownerId, input.organizationId),
      this.repository.getToolExecutionsByRequest(run.requestId, input.ownerId, input.organizationId),
    ]);

    return buildRetrievalTrace({
      run,
      snapshot,
      toolExecutions,
      memoryWrites: [],
    });
  }
}

export function buildRetrievalTraceFromContext(input: {
  run: RetrievalRun;
  retrieval: RetrievalContext;
  toolExecutions: ToolExecution[];
  memoryWrites: AgentMemory[];
}): RetrievalTrace {
  return retrievalTraceSchema.parse({
    run: input.run,
    chunks: input.retrieval.chunks,
    nodes: input.retrieval.nodes,
    edges: input.retrieval.edges,
    path: buildPath(input.retrieval.nodes.map((row) => row.node), input.retrieval.edges.map((row) => row.edge)),
    citations: input.retrieval.citations,
    toolExecutions: input.toolExecutions,
    memoryWrites: input.memoryWrites,
    coverageNotes: input.retrieval.coverageNotes,
  });
}

function buildRetrievalTrace(input: {
  run: RetrievalRun;
  snapshot: GraphRagSnapshot;
  toolExecutions: ToolExecution[];
  memoryWrites: AgentMemory[];
}) {
  const chunkIds = new Set(input.run.retrievedChunkIds);
  const nodeIds = new Set(input.run.retrievedNodeIds);
  const chunks = input.snapshot.chunks
    .filter((chunk) => chunkIds.has(chunk.id))
    .map((chunk) => ({
      chunk,
      score: 0,
      reasons: ["persisted_trace"],
    }));
  const nodes = input.snapshot.nodes
    .filter((node) => nodeIds.has(node.id))
    .map((node) => ({
      node,
      score: node.confidence,
      distance: node.kind === "chunk" ? 0 : 1,
    }));
  const edges = input.snapshot.edges
    .filter((edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId))
    .map((edge) => ({
      edge,
      score: edge.confidence,
    }));

  return retrievalTraceSchema.parse({
    run: input.run,
    chunks,
    nodes,
    edges,
    path: buildPath(nodes.map((row) => row.node), edges.map((row) => row.edge)),
    citations: input.run.citations,
    toolExecutions: input.toolExecutions,
    memoryWrites: input.memoryWrites,
    coverageNotes: ["Loaded from persisted retrieval trace."],
  });
}

function buildPath(
  nodes: Array<{ id: string; label: string }>,
  edges: Array<{
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    type: GraphTracePathStep["type"];
    confidence: number;
    provenance: string;
  }>,
): GraphTracePathStep[] {
  const labels = new Map(nodes.map((node) => [node.id, node.label]));

  return edges.map((edge) => ({
    edgeId: edge.id,
    sourceNodeId: edge.sourceNodeId,
    sourceLabel: labels.get(edge.sourceNodeId) ?? edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    targetLabel: labels.get(edge.targetNodeId) ?? edge.targetNodeId,
    type: edge.type,
    confidence: edge.confidence,
    provenance: edge.provenance,
  }));
}
