import type { AgentInputItem } from "@openai/agents";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import { generateSampleGraph } from "@/lib/graph/sample-data";
import { logStructured } from "@/services/observability";
import {
  type AgentMemory,
  type DocumentChunk,
  type DocumentRecord,
  type GraphRagImportResult,
  type GraphSuggestion,
  type GraphSuggestionStatus,
  type RagGraphEdge,
  type RagGraphNode,
  type RetrievalRun,
  type ToolExecution,
  type VectorChunkMatch,
} from "@/schemas/graph-rag";
import { makeEmbeddingSeed } from "@/services/graph-rag-ingestion";

export type GraphRagSnapshot = {
  documents: DocumentRecord[];
  chunks: DocumentChunk[];
  nodes: RagGraphNode[];
  edges: RagGraphEdge[];
  memories: AgentMemory[];
};

export interface GraphRagRepository {
  getSnapshot(ownerId: string, organizationId: string): Promise<GraphRagSnapshot>;
  saveImportedDocument(importResult: GraphRagImportResult): Promise<GraphRagImportResult>;
  vectorSearchChunks(ownerId: string, organizationId: string, embedding: number[], limit: number): Promise<VectorChunkMatch[]>;
  saveRetrievalRun(run: RetrievalRun): Promise<void>;
  saveToolExecution(execution: ToolExecution): Promise<void>;
  getToolExecutionsByRequest(requestId: string, ownerId: string, organizationId: string): Promise<ToolExecution[]>;
  saveMemory(memory: AgentMemory): Promise<void>;
  searchMemories(ownerId: string, organizationId: string, query: string): Promise<AgentMemory[]>;
  listSuggestions(ownerId: string, organizationId: string, status?: GraphSuggestionStatus): Promise<GraphSuggestion[]>;
  saveSuggestions(suggestions: GraphSuggestion[]): Promise<GraphSuggestion[]>;
  approveSuggestion(suggestionId: string, reviewedBy: string): Promise<GraphSuggestion | null>;
  rejectSuggestion(suggestionId: string, reviewedBy: string, rejectionReason?: string): Promise<GraphSuggestion | null>;
}

export interface AgentSessionRepository {
  getSessionItems(sessionId: string): Promise<AgentInputItem[]>;
  appendSessionItems(sessionId: string, items: AgentInputItem[]): Promise<void>;
  popSessionItem(sessionId: string): Promise<AgentInputItem | undefined>;
  clearSession(sessionId: string): Promise<void>;
}

const seededAt = new Date("2026-05-16T00:00:00.000Z").toISOString();

function makeId(prefix: string, value: string) {
  return `${prefix}_${value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
}

function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.35));
}

function createSeedSnapshot(ownerId: string, organizationId: string): GraphRagSnapshot {
  const graph = generateSampleGraph();
  const documentId = "doc_seed_knowledge_graph";

  const document: DocumentRecord = {
    id: documentId,
    ownerId,
    organizationId,
    title: "Seed Knowledge Graph",
    sourceType: "text",
    checksum: "seed-knowledge-graph-v1",
    status: "ready",
    createdAt: seededAt,
    updatedAt: seededAt,
  };

  const chunks = graph.nodes.map((node, index): DocumentChunk => {
    const text = `${node.id}. ${node.desc}`;

    return {
      id: makeId("chunk", node.id),
      documentId,
      ownerId,
      organizationId,
      text,
      tokenCount: estimateTokenCount(text),
      sourceSpan: { start: index, end: index + 1 },
      embedding: makeEmbeddingSeed(text),
      visible: true,
      version: 1,
      createdAt: seededAt,
    };
  });

  const nodes: RagGraphNode[] = [
    ...chunks.map((chunk): RagGraphNode => ({
      id: makeId("node_chunk", chunk.id),
      ownerId,
      organizationId,
      kind: "chunk",
      label: chunk.text.split(".")[0] ?? chunk.id,
      description: chunk.text,
      chunkId: chunk.id,
      documentId,
      properties: { source: "seed" },
      confidence: 1,
      createdAt: seededAt,
      updatedAt: seededAt,
    })),
    ...graph.nodes.map((node): RagGraphNode => ({
      id: makeId("node_entity", node.id),
      ownerId,
      organizationId,
      kind: "entity",
      label: node.id,
      description: node.desc,
      documentId,
      properties: { group: String(node.group) },
      confidence: 0.95,
      createdAt: seededAt,
      updatedAt: seededAt,
    })),
  ];

  const edges: RagGraphEdge[] = [
    ...graph.nodes.map((node): RagGraphEdge => {
      const chunkId = makeId("chunk", node.id);
      return {
        id: makeId("edge_mentions", node.id),
        ownerId,
        organizationId,
        sourceNodeId: makeId("node_chunk", chunkId),
        targetNodeId: makeId("node_entity", node.id),
        type: "MENTIONS",
        confidence: 1,
        sourceChunkIds: [chunkId],
        provenance: "Seed graph chunk/entity link",
        createdAt: seededAt,
      };
    }),
    ...graph.links.map((link, index): RagGraphEdge => ({
      id: `edge_seed_${index}`,
      ownerId,
      organizationId,
      sourceNodeId: makeId("node_entity", link.source),
      targetNodeId: makeId("node_entity", link.target),
      type: link.type === "part_of" ? "PART_OF" : link.type === "dependency" ? "DEPENDS_ON" : "RELATES_TO",
      confidence: 0.82,
      sourceChunkIds: [makeId("chunk", link.source), makeId("chunk", link.target)],
      provenance: link.name,
      createdAt: seededAt,
    })),
  ];

  return {
    documents: [document],
    chunks,
    nodes,
    edges,
    memories: [],
  };
}

export class LocalGraphRagRepository implements GraphRagRepository, AgentSessionRepository {
  private readonly snapshots = new Map<string, GraphRagSnapshot>();
  private readonly retrievalRuns: RetrievalRun[] = [];
  private readonly toolExecutions: ToolExecution[] = [];
  private readonly sessionItems = new Map<string, AgentInputItem[]>();
  private readonly suggestions: GraphSuggestion[] = [];

  async getSnapshot(ownerId: string, organizationId: string) {
    const key = `${organizationId}:${ownerId}`;
    const existing = this.snapshots.get(key);

    if (existing) {
      return existing;
    }

    const snapshot = createSeedSnapshot(ownerId, organizationId);
    this.snapshots.set(key, snapshot);
    return snapshot;
  }

  async saveImportedDocument(importResult: GraphRagImportResult) {
    const snapshot = await this.getSnapshot(importResult.document.ownerId, importResult.document.organizationId);
    const existingDocument = snapshot.documents.find((document) => document.checksum === importResult.document.checksum);

    if (!existingDocument) {
      snapshot.documents.push(importResult.document);
    }

    importResult.chunks.forEach((chunk) => {
      if (!snapshot.chunks.some((candidate) => candidate.id === chunk.id)) {
        snapshot.chunks.push(chunk);
        snapshot.nodes.push({
          id: makeId("node_chunk", chunk.id),
          ownerId: chunk.ownerId,
          organizationId: chunk.organizationId,
          kind: "chunk",
          label: chunk.text.split(".")[0] ?? chunk.id,
          description: chunk.text,
          chunkId: chunk.id,
          documentId: chunk.documentId,
          properties: { source: "local_import" },
          confidence: 1,
          createdAt: chunk.createdAt,
          updatedAt: chunk.createdAt,
        });
      }
    });

    return importResult;
  }

  async vectorSearchChunks(ownerId: string, organizationId: string, embedding: number[], limit: number) {
    void ownerId;
    void organizationId;
    void embedding;
    void limit;
    return [];
  }

  async saveRetrievalRun(run: RetrievalRun) {
    this.retrievalRuns.push(run);
  }

  async saveToolExecution(execution: ToolExecution) {
    this.toolExecutions.push(execution);
  }

  async getToolExecutionsByRequest(requestId: string, ownerId: string, organizationId: string) {
    return this.toolExecutions.filter(
      (execution) => execution.requestId === requestId && execution.ownerId === ownerId && execution.organizationId === organizationId,
    );
  }

  async saveMemory(memory: AgentMemory) {
    const snapshot = await this.getSnapshot(memory.ownerId, memory.organizationId);
    snapshot.memories.push(memory);
  }

  async searchMemories(ownerId: string, organizationId: string, query: string) {
    const snapshot = await this.getSnapshot(ownerId, organizationId);
    const normalized = query.toLowerCase();
    return snapshot.memories.filter((memory) => memory.summary.toLowerCase().includes(normalized));
  }

  async listSuggestions(ownerId: string, organizationId: string, status?: GraphSuggestionStatus) {
    return this.suggestions.filter(
      (suggestion) =>
        suggestion.ownerId === ownerId &&
        suggestion.organizationId === organizationId &&
        (status ? suggestion.status === status : true),
    );
  }

  async saveSuggestions(suggestions: GraphSuggestion[]) {
    const saved: GraphSuggestion[] = [];

    suggestions.forEach((suggestion) => {
      const existing = this.suggestions.find(
        (candidate) =>
          candidate.ownerId === suggestion.ownerId &&
          candidate.organizationId === suggestion.organizationId &&
          candidate.sourceChunkId === suggestion.sourceChunkId &&
          candidate.rationale === suggestion.rationale,
      );

      if (existing) {
        saved.push(existing);
        return;
      }

      this.suggestions.push(suggestion);
      saved.push(suggestion);
    });

    return saved;
  }

  async approveSuggestion(suggestionId: string, reviewedBy: string) {
    const suggestion = this.suggestions.find((candidate) => candidate.id === suggestionId);

    if (!suggestion || suggestion.status !== "pending") {
      return null;
    }

    const now = new Date().toISOString();
    const snapshot = await this.getSnapshot(suggestion.ownerId, suggestion.organizationId);

    if (suggestion.proposedNode && !snapshot.nodes.some((node) => node.id === suggestion.proposedNode?.id)) {
      snapshot.nodes.push({
        id: suggestion.proposedNode.id,
        ownerId: suggestion.ownerId,
        organizationId: suggestion.organizationId,
        kind: suggestion.proposedNode.kind,
        label: suggestion.proposedNode.label,
        description: suggestion.proposedNode.description,
        properties: suggestion.proposedNode.properties,
        confidence: suggestion.proposedNode.confidence,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (suggestion.proposedEdge) {
      snapshot.edges.push({
        id: makeId("edge_suggestion", `${suggestion.id}_${snapshot.edges.length}`),
        ownerId: suggestion.ownerId,
        organizationId: suggestion.organizationId,
        sourceNodeId: suggestion.proposedEdge.sourceNodeId,
        targetNodeId: suggestion.proposedEdge.targetNodeId,
        type: suggestion.proposedEdge.type,
        confidence: suggestion.proposedEdge.confidence,
        sourceChunkIds: [suggestion.sourceChunkId],
        provenance: suggestion.proposedEdge.provenance,
        createdAt: now,
      });
    }

    suggestion.status = "approved";
    suggestion.reviewedAt = now;
    suggestion.reviewedBy = reviewedBy;
    suggestion.updatedAt = now;
    return suggestion;
  }

  async rejectSuggestion(suggestionId: string, reviewedBy: string, rejectionReason?: string) {
    const suggestion = this.suggestions.find((candidate) => candidate.id === suggestionId);

    if (!suggestion || suggestion.status !== "pending") {
      return null;
    }

    const now = new Date().toISOString();
    suggestion.status = "rejected";
    suggestion.reviewedAt = now;
    suggestion.reviewedBy = reviewedBy;
    suggestion.rejectionReason = rejectionReason;
    suggestion.updatedAt = now;
    return suggestion;
  }

  async getSessionItems(sessionId: string) {
    return [...(this.sessionItems.get(sessionId) ?? [])];
  }

  async appendSessionItems(sessionId: string, items: AgentInputItem[]) {
    const existing = this.sessionItems.get(sessionId) ?? [];
    this.sessionItems.set(sessionId, [...existing, ...items]);
  }

  async popSessionItem(sessionId: string) {
    const existing = this.sessionItems.get(sessionId) ?? [];
    const item = existing.pop();
    this.sessionItems.set(sessionId, existing);
    return item;
  }

  async clearSession(sessionId: string) {
    this.sessionItems.delete(sessionId);
  }
}

type ScopeArgs = {
  ownerId: string;
  organizationId: string;
};

type VectorSearchArgs = ScopeArgs & {
  embedding: number[];
  limit: number;
};

type SessionAppendArgs = ScopeArgs & {
  sessionId: string;
  items: string[];
};

const convexGraphRagFns = {
  getSnapshot: makeFunctionReference<"query", ScopeArgs, GraphRagSnapshot>("graphRag:getSnapshot"),
  ingestDocument: makeFunctionReference<"mutation", GraphRagImportResult, GraphRagImportResult>("graphRag:ingestDocument"),
  searchChunkEmbeddings: makeFunctionReference<"action", VectorSearchArgs, VectorChunkMatch[]>("graphRag:searchChunkEmbeddings"),
  saveRetrievalRun: makeFunctionReference<"mutation", { run: RetrievalRun }, null>("graphRag:saveRetrievalRun"),
  saveToolExecution: makeFunctionReference<"mutation", { execution: ToolExecution }, null>("graphRag:saveToolExecution"),
  getToolExecutionsByRequest: makeFunctionReference<"query", ScopeArgs & { requestId: string }, ToolExecution[]>(
    "graphRag:getToolExecutionsByRequest",
  ),
  saveMemory: makeFunctionReference<"mutation", { memory: AgentMemory }, null>("graphRag:saveMemory"),
  searchMemories: makeFunctionReference<"query", ScopeArgs & { query: string }, AgentMemory[]>("graphRag:searchMemories"),
  listSuggestions: makeFunctionReference<"query", ScopeArgs & { status?: GraphSuggestionStatus }, GraphSuggestion[]>("graphRag:listSuggestions"),
  saveSuggestions: makeFunctionReference<"mutation", { suggestions: GraphSuggestion[] }, GraphSuggestion[]>("graphRag:saveSuggestions"),
  approveSuggestion: makeFunctionReference<"mutation", { suggestionId: string; reviewedBy: string }, GraphSuggestion | null>(
    "graphRag:approveSuggestion",
  ),
  rejectSuggestion: makeFunctionReference<
    "mutation",
    { suggestionId: string; reviewedBy: string; rejectionReason?: string },
    GraphSuggestion | null
  >("graphRag:rejectSuggestion"),
  getSessionItems: makeFunctionReference<"query", { sessionId: string }, string[]>("graphRag:getSessionItems"),
  appendSessionItems: makeFunctionReference<"mutation", SessionAppendArgs, null>("graphRag:appendSessionItems"),
  popSessionItem: makeFunctionReference<"mutation", { sessionId: string }, string | null>("graphRag:popSessionItem"),
  clearSession: makeFunctionReference<"mutation", { sessionId: string }, null>("graphRag:clearSession"),
};

export class ConvexGraphRagRepository implements GraphRagRepository, AgentSessionRepository {
  constructor(
    private readonly client: ConvexHttpClient,
    private readonly fallback: LocalGraphRagRepository,
  ) {}

  async getSnapshot(ownerId: string, organizationId: string) {
    return this.safeConvex(() => this.client.query(convexGraphRagFns.getSnapshot, { ownerId, organizationId }), () =>
      this.fallback.getSnapshot(ownerId, organizationId),
    );
  }

  async saveImportedDocument(importResult: GraphRagImportResult) {
    return this.safeConvex(() => this.client.mutation(convexGraphRagFns.ingestDocument, importResult), () =>
      this.fallback.saveImportedDocument(importResult),
    );
  }

  async vectorSearchChunks(ownerId: string, organizationId: string, embedding: number[], limit: number) {
    return this.safeConvex(
      () => this.client.action(convexGraphRagFns.searchChunkEmbeddings, { ownerId, organizationId, embedding, limit }),
      () => this.fallback.vectorSearchChunks(ownerId, organizationId, embedding, limit),
    );
  }

  async saveRetrievalRun(run: RetrievalRun) {
    await this.safeConvex(() => this.client.mutation(convexGraphRagFns.saveRetrievalRun, { run }), () => this.fallback.saveRetrievalRun(run));
  }

  async saveToolExecution(execution: ToolExecution) {
    await this.safeConvex(
      () => this.client.mutation(convexGraphRagFns.saveToolExecution, { execution }),
      () => this.fallback.saveToolExecution(execution),
    );
  }

  async getToolExecutionsByRequest(requestId: string, ownerId: string, organizationId: string) {
    return this.safeConvex(
      () => this.client.query(convexGraphRagFns.getToolExecutionsByRequest, { requestId, ownerId, organizationId }),
      () => this.fallback.getToolExecutionsByRequest(requestId, ownerId, organizationId),
    );
  }

  async saveMemory(memory: AgentMemory) {
    await this.safeConvex(() => this.client.mutation(convexGraphRagFns.saveMemory, { memory }), () => this.fallback.saveMemory(memory));
  }

  async searchMemories(ownerId: string, organizationId: string, query: string) {
    return this.safeConvex(
      () => this.client.query(convexGraphRagFns.searchMemories, { ownerId, organizationId, query }),
      () => this.fallback.searchMemories(ownerId, organizationId, query),
    );
  }

  async listSuggestions(ownerId: string, organizationId: string, status?: GraphSuggestionStatus) {
    return this.safeConvex(
      () => this.client.query(convexGraphRagFns.listSuggestions, { ownerId, organizationId, status }),
      () => this.fallback.listSuggestions(ownerId, organizationId, status),
    );
  }

  async saveSuggestions(suggestions: GraphSuggestion[]) {
    return this.safeConvex(
      () => this.client.mutation(convexGraphRagFns.saveSuggestions, { suggestions }),
      () => this.fallback.saveSuggestions(suggestions),
    );
  }

  async approveSuggestion(suggestionId: string, reviewedBy: string) {
    return this.safeConvex(
      () => this.client.mutation(convexGraphRagFns.approveSuggestion, { suggestionId, reviewedBy }),
      () => this.fallback.approveSuggestion(suggestionId, reviewedBy),
    );
  }

  async rejectSuggestion(suggestionId: string, reviewedBy: string, rejectionReason?: string) {
    return this.safeConvex(
      () => this.client.mutation(convexGraphRagFns.rejectSuggestion, { suggestionId, reviewedBy, rejectionReason }),
      () => this.fallback.rejectSuggestion(suggestionId, reviewedBy, rejectionReason),
    );
  }

  async getSessionItems(sessionId: string) {
    const items = await this.safeConvex(() => this.client.query(convexGraphRagFns.getSessionItems, { sessionId }), () =>
      this.fallback.getSessionItems(sessionId).then((fallbackItems) => fallbackItems.map((item) => JSON.stringify(item))),
    );

    return items.map((item) => JSON.parse(item) as AgentInputItem);
  }

  async appendSessionItems(sessionId: string, items: AgentInputItem[]) {
    await this.safeConvex(
      () =>
        this.client.mutation(convexGraphRagFns.appendSessionItems, {
          sessionId,
          ownerId: "local-user",
          organizationId: "local-org",
          items: items.map((item) => JSON.stringify(item)),
        }),
      () => this.fallback.appendSessionItems(sessionId, items),
    );
  }

  async popSessionItem(sessionId: string) {
    const item = await this.safeConvex(() => this.client.mutation(convexGraphRagFns.popSessionItem, { sessionId }), () =>
      this.fallback.popSessionItem(sessionId).then((fallbackItem) => (fallbackItem ? JSON.stringify(fallbackItem) : null)),
    );

    return item ? (JSON.parse(item) as AgentInputItem) : undefined;
  }

  async clearSession(sessionId: string) {
    await this.safeConvex(() => this.client.mutation(convexGraphRagFns.clearSession, { sessionId }), () => this.fallback.clearSession(sessionId));
  }

  private async safeConvex<Result>(operation: () => Promise<Result>, fallback: () => Promise<Result>) {
    try {
      return await operation();
    } catch (error) {
      logStructured("warn", {
        event: "convex_graph_rag_fallback",
        metadata: {
          reason: error instanceof Error ? error.message.slice(0, 160) : "unknown",
        },
      });
      return fallback();
    }
  }
}

function createGraphRagRepository() {
  const fallback = new LocalGraphRagRepository();
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    return fallback;
  }

  return new ConvexGraphRagRepository(new ConvexHttpClient(convexUrl, { logger: false }), fallback);
}

export const graphRagRepository = createGraphRagRepository();
