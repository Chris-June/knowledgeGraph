import type { AgentInputItem } from "@openai/agents";

import { generateSampleGraph } from "@/lib/graph/sample-data";
import {
  type AgentMemory,
  type DocumentChunk,
  type DocumentRecord,
  type RagGraphEdge,
  type RagGraphNode,
  type RetrievalRun,
  type ToolExecution,
} from "@/schemas/graph-rag";

export type GraphRagSnapshot = {
  documents: DocumentRecord[];
  chunks: DocumentChunk[];
  nodes: RagGraphNode[];
  edges: RagGraphEdge[];
  memories: AgentMemory[];
};

export interface GraphRagRepository {
  getSnapshot(ownerId: string, organizationId: string): Promise<GraphRagSnapshot>;
  saveRetrievalRun(run: RetrievalRun): Promise<void>;
  saveToolExecution(execution: ToolExecution): Promise<void>;
  saveMemory(memory: AgentMemory): Promise<void>;
  searchMemories(ownerId: string, organizationId: string, query: string): Promise<AgentMemory[]>;
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

function makeEmbeddingSeed(text: string) {
  const values = Array.from({ length: 1536 }, (_, index) => {
    const code = text.charCodeAt(index % Math.max(text.length, 1)) || 0;
    return ((code + index * 17) % 1000) / 1000;
  });

  return values;
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

  async saveRetrievalRun(run: RetrievalRun) {
    this.retrievalRuns.push(run);
  }

  async saveToolExecution(execution: ToolExecution) {
    this.toolExecutions.push(execution);
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

export const graphRagRepository = new LocalGraphRagRepository();
