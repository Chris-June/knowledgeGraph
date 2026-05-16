import { actionGeneric, mutationGeneric, queryGeneric } from "convex/server";
import type { GenericDataModel, GenericMutationCtx } from "convex/server";
import type { GenericId } from "convex/values";
import { v } from "convex/values";

type MutationCtx = GenericMutationCtx<GenericDataModel>;

const sourceSpanValidator = v.object({
  start: v.number(),
  end: v.number(),
});

const citationValidator = v.object({
  chunkId: v.string(),
  documentId: v.string(),
  label: v.string(),
  sourceSpan: sourceSpanValidator,
  quote: v.string(),
});

const documentValidator = v.object({
  id: v.string(),
  ownerId: v.string(),
  organizationId: v.string(),
  title: v.string(),
  sourceType: v.union(v.literal("text"), v.literal("markdown"), v.literal("pdf"), v.literal("url"), v.literal("upload")),
  checksum: v.string(),
  status: v.union(v.literal("queued"), v.literal("processing"), v.literal("ready"), v.literal("failed")),
  createdAt: v.string(),
  updatedAt: v.string(),
});

const chunkValidator = v.object({
  id: v.string(),
  documentId: v.string(),
  ownerId: v.string(),
  organizationId: v.string(),
  text: v.string(),
  tokenCount: v.number(),
  sourceSpan: sourceSpanValidator,
  embedding: v.optional(v.array(v.float64())),
  visible: v.boolean(),
  version: v.number(),
  createdAt: v.string(),
});

const importRunValidator = v.object({
  id: v.string(),
  ownerId: v.string(),
  organizationId: v.string(),
  status: v.union(v.literal("queued"), v.literal("chunking"), v.literal("extracting"), v.literal("indexing"), v.literal("ready"), v.literal("failed")),
  model: v.optional(v.string()),
  error: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
});

const retrievalRunValidator = v.object({
  id: v.string(),
  ownerId: v.string(),
  organizationId: v.string(),
  query: v.string(),
  strategy: v.union(v.literal("local_graph"), v.literal("vector_graph"), v.literal("entity_graph"), v.literal("memory_graph")),
  retrievedNodeIds: v.array(v.string()),
  retrievedChunkIds: v.array(v.string()),
  confidence: v.number(),
  citations: v.array(citationValidator),
  createdAt: v.string(),
});

const memoryValidator = v.object({
  id: v.string(),
  ownerId: v.string(),
  organizationId: v.string(),
  scope: v.union(v.literal("short"), v.literal("medium"), v.literal("long")),
  summary: v.string(),
  sourceRunId: v.optional(v.string()),
  retentionPolicy: v.union(v.literal("session"), v.literal("project"), v.literal("organization")),
  createdAt: v.string(),
  updatedAt: v.string(),
});

const toolExecutionValidator = v.object({
  id: v.string(),
  ownerId: v.string(),
  organizationId: v.string(),
  requestId: v.optional(v.string()),
  toolName: v.string(),
  argsHash: v.string(),
  resultSummary: v.string(),
  latencyMs: v.number(),
  success: v.boolean(),
  error: v.optional(v.string()),
  createdAt: v.string(),
});

const proposedNodeValidator = v.object({
  id: v.string(),
  kind: v.union(
    v.literal("chunk"),
    v.literal("entity"),
    v.literal("concept"),
    v.literal("claim"),
    v.literal("summary"),
    v.literal("community"),
    v.literal("memory"),
  ),
  label: v.string(),
  description: v.string(),
  properties: v.record(v.string(), v.string()),
  confidence: v.number(),
});

const proposedEdgeValidator = v.object({
  sourceNodeId: v.string(),
  targetNodeId: v.string(),
  type: v.union(
    v.literal("MENTIONS"),
    v.literal("SUPPORTS"),
    v.literal("DERIVED_FROM"),
    v.literal("RELATES_TO"),
    v.literal("CAUSES"),
    v.literal("DEPENDS_ON"),
    v.literal("PART_OF"),
    v.literal("CONTRADICTS"),
    v.literal("SAME_AS"),
  ),
  provenance: v.string(),
  confidence: v.number(),
});

const graphSuggestionValidator = v.object({
  id: v.string(),
  ownerId: v.string(),
  organizationId: v.string(),
  sourceChunkId: v.string(),
  sourceText: v.string(),
  type: v.union(v.literal("entity"), v.literal("concept"), v.literal("claim"), v.literal("edge")),
  status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
  proposedNode: v.optional(proposedNodeValidator),
  proposedEdge: v.optional(proposedEdgeValidator),
  rationale: v.string(),
  confidence: v.number(),
  createdAt: v.string(),
  updatedAt: v.string(),
  reviewedAt: v.optional(v.string()),
  reviewedBy: v.optional(v.string()),
  rejectionReason: v.optional(v.string()),
});

export const getSnapshot = queryGeneric({
  args: {
    ownerId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_organization", (query) => query.eq("organizationId", args.organizationId))
      .collect();
    const chunks = await ctx.db
      .query("documentChunks")
      .withIndex("by_organization", (query) => query.eq("organizationId", args.organizationId))
      .collect();
    const nodes = await ctx.db
      .query("graphNodes")
      .withIndex("by_organization", (query) => query.eq("organizationId", args.organizationId))
      .collect();
    const edges = await ctx.db
      .query("graphEdges")
      .withIndex("by_organization", (query) => query.eq("organizationId", args.organizationId))
      .collect();
    const memories = await ctx.db
      .query("agentMemories")
      .withIndex("by_organization", (query) => query.eq("organizationId", args.organizationId))
      .collect();

    return {
      documents: documents
        .filter((document) => document.ownerId === args.ownerId)
        .map((document) => ({
          id: String(document._id),
          ownerId: document.ownerId,
          organizationId: document.organizationId,
          title: document.title,
          sourceType: document.sourceType,
          checksum: document.checksum,
          status: document.status,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        })),
      chunks: chunks
        .filter((chunk) => chunk.ownerId === args.ownerId)
        .map((chunk) => ({
          id: String(chunk._id),
          documentId: String(chunk.documentId),
          ownerId: chunk.ownerId,
          organizationId: chunk.organizationId,
          text: chunk.text,
          tokenCount: chunk.tokenCount,
          sourceSpan: chunk.sourceSpan,
          visible: chunk.visible,
          version: chunk.version,
          createdAt: chunk.createdAt,
        })),
      nodes: nodes
        .filter((node) => node.ownerId === args.ownerId)
        .map((node) => ({
          id: node.nodeId,
          ownerId: node.ownerId ?? args.ownerId,
          organizationId: node.organizationId ?? args.organizationId,
          kind: node.kind ?? "entity",
          label: node.label ?? node.nodeId,
          description: node.desc,
          chunkId: node.chunkId ? String(node.chunkId) : undefined,
          documentId: node.documentId ? String(node.documentId) : undefined,
          properties: node.properties ?? {},
          confidence: node.confidence ?? 1,
          createdAt: documents.find((document) => document._id === node.documentId)?.createdAt ?? new Date(0).toISOString(),
          updatedAt: documents.find((document) => document._id === node.documentId)?.updatedAt ?? new Date(0).toISOString(),
        })),
      edges: edges
        .filter((edge) => edge.ownerId === args.ownerId)
        .map((edge) => ({
          id: String(edge._id),
          ownerId: edge.ownerId,
          organizationId: edge.organizationId,
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId,
          type: edge.type,
          confidence: edge.confidence,
          extractionRunId: edge.extractionRunId,
          sourceChunkIds: edge.sourceChunkIds,
          provenance: edge.provenance,
          createdAt: edge.createdAt,
        })),
      memories: memories
        .filter((memory) => memory.ownerId === args.ownerId)
        .map((memory) => ({
          id: String(memory._id),
          ownerId: memory.ownerId,
          organizationId: memory.organizationId,
          scope: memory.scope,
          summary: memory.summary,
          sourceRunId: memory.sourceRunId,
          retentionPolicy: memory.retentionPolicy,
          createdAt: memory.createdAt,
          updatedAt: memory.updatedAt,
        })),
    };
  },
});

export const ingestDocument = mutationGeneric({
  args: {
    document: documentValidator,
    chunks: v.array(chunkValidator),
    importRun: importRunValidator,
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const existingDocuments = await ctx.db
      .query("documents")
      .withIndex("by_checksum", (query) => query.eq("checksum", args.document.checksum))
      .collect();
    const existingDocument = existingDocuments.find(
      (document) => document.ownerId === args.document.ownerId && document.organizationId === args.document.organizationId,
    );
    const documentId =
      existingDocument?._id ??
      (await ctx.db.insert("documents", {
        ownerId: args.document.ownerId,
        organizationId: args.document.organizationId,
        title: args.document.title,
        sourceType: args.document.sourceType,
        checksum: args.document.checksum,
        status: "ready",
        createdAt: args.document.createdAt,
        updatedAt: args.document.updatedAt,
      }));

    const graphId = (await ensureGraph(ctx, args.document.ownerId, args.document.organizationId)) as GenericId<"graphs">;
    const chunkRows = [];

    for (const chunk of args.chunks) {
      const chunkId = await ctx.db.insert("documentChunks", {
        documentId,
        ownerId: chunk.ownerId,
        organizationId: chunk.organizationId,
        text: chunk.text,
        tokenCount: chunk.tokenCount,
        sourceSpan: chunk.sourceSpan,
        embedding: chunk.embedding ?? [],
        visible: chunk.visible,
        version: chunk.version,
        createdAt: chunk.createdAt,
      });
      const nodeId = `node_chunk_${String(chunkId)}`;

      await upsertGraphNode(ctx, graphId, {
        ownerId: chunk.ownerId,
        organizationId: chunk.organizationId,
        nodeId,
        kind: "chunk",
        label: chunk.text.split(".")[0] ?? String(chunkId),
        group: 8,
        val: 18,
        desc: chunk.text,
        chunkId,
        documentId,
        properties: { source: "ingested_document", clientChunkId: chunk.id },
        confidence: 1,
      });

      chunkRows.push({
        id: String(chunkId),
        documentId: String(documentId),
        ownerId: chunk.ownerId,
        organizationId: chunk.organizationId,
        text: chunk.text,
        tokenCount: chunk.tokenCount,
        sourceSpan: chunk.sourceSpan,
        visible: chunk.visible,
        version: chunk.version,
        createdAt: chunk.createdAt,
      });
    }

    const importRunId = await ctx.db.insert("importRuns", {
      ownerId: args.importRun.ownerId,
      organizationId: args.importRun.organizationId,
      status: "ready",
      model: args.importRun.model,
      error: args.importRun.error,
      createdAt: args.importRun.createdAt,
      updatedAt: now,
    });

    return {
      document: {
        id: String(documentId),
        ownerId: args.document.ownerId,
        organizationId: args.document.organizationId,
        title: args.document.title,
        sourceType: args.document.sourceType,
        checksum: args.document.checksum,
        status: "ready",
        createdAt: args.document.createdAt,
        updatedAt: now,
      },
      chunks: chunkRows,
      importRun: {
        id: String(importRunId),
        ownerId: args.importRun.ownerId,
        organizationId: args.importRun.organizationId,
        status: "ready",
        model: args.importRun.model,
        error: args.importRun.error,
        createdAt: args.importRun.createdAt,
        updatedAt: now,
      },
    };
  },
});

export const saveRetrievalRun = mutationGeneric({
  args: {
    run: retrievalRunValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("retrievalRuns", {
      ownerId: args.run.ownerId,
      organizationId: args.run.organizationId,
      query: args.run.query,
      strategy: args.run.strategy,
      retrievedNodeIds: args.run.retrievedNodeIds,
      retrievedChunkIds: args.run.retrievedChunkIds,
      confidence: args.run.confidence,
      citations: args.run.citations,
      createdAt: args.run.createdAt,
    });
  },
});

export const saveToolExecution = mutationGeneric({
  args: {
    execution: toolExecutionValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("toolExecutions", {
      ownerId: args.execution.ownerId,
      organizationId: args.execution.organizationId,
      requestId: args.execution.requestId,
      toolName: args.execution.toolName,
      argsHash: args.execution.argsHash,
      resultSummary: args.execution.resultSummary,
      latencyMs: args.execution.latencyMs,
      success: args.execution.success,
      error: args.execution.error,
      createdAt: args.execution.createdAt,
    });
  },
});

export const getToolExecutionsByRequest = queryGeneric({
  args: {
    requestId: v.string(),
    ownerId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const executions = await ctx.db
      .query("toolExecutions")
      .withIndex("by_request", (query) => query.eq("requestId", args.requestId))
      .collect();

    return executions
      .filter((execution) => execution.ownerId === args.ownerId && execution.organizationId === args.organizationId)
      .map((execution) => ({
        id: String(execution._id),
        ownerId: execution.ownerId,
        organizationId: execution.organizationId,
        requestId: execution.requestId,
        toolName: execution.toolName,
        argsHash: execution.argsHash,
        resultSummary: execution.resultSummary,
        latencyMs: execution.latencyMs,
        success: execution.success,
        error: execution.error,
        createdAt: execution.createdAt,
      }));
  },
});

export const saveMemory = mutationGeneric({
  args: {
    memory: memoryValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentMemories", {
      ownerId: args.memory.ownerId,
      organizationId: args.memory.organizationId,
      scope: args.memory.scope,
      summary: args.memory.summary,
      sourceRunId: args.memory.sourceRunId,
      retentionPolicy: args.memory.retentionPolicy,
      createdAt: args.memory.createdAt,
      updatedAt: args.memory.updatedAt,
    });
  },
});

export const listSuggestions = queryGeneric({
  args: {
    ownerId: v.string(),
    organizationId: v.string(),
    status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
  },
  handler: async (ctx, args) => {
    const suggestions = args.status
      ? await ctx.db
          .query("graphSuggestions")
          .withIndex("by_org_status", (query) => query.eq("organizationId", args.organizationId))
          .filter((query) => query.eq(query.field("status"), args.status))
          .collect()
      : await ctx.db
          .query("graphSuggestions")
          .withIndex("by_org_status", (query) => query.eq("organizationId", args.organizationId))
          .collect();

    return suggestions
      .filter((suggestion) => suggestion.ownerId === args.ownerId)
      .map((suggestion) => ({
        id: String(suggestion._id),
        ownerId: suggestion.ownerId,
        organizationId: suggestion.organizationId,
        sourceChunkId: suggestion.sourceChunkId,
        sourceText: suggestion.sourceText,
        type: suggestion.type,
        status: suggestion.status,
        proposedNode: suggestion.proposedNode,
        proposedEdge: suggestion.proposedEdge,
        rationale: suggestion.rationale,
        confidence: suggestion.confidence,
        createdAt: suggestion.createdAt,
        updatedAt: suggestion.updatedAt,
        reviewedAt: suggestion.reviewedAt,
        reviewedBy: suggestion.reviewedBy,
        rejectionReason: suggestion.rejectionReason,
      }));
  },
});

export const saveSuggestions = mutationGeneric({
  args: {
    suggestions: v.array(graphSuggestionValidator),
  },
  handler: async (ctx, args) => {
    const saved = [];

    for (const suggestion of args.suggestions) {
      const existing = await ctx.db
        .query("graphSuggestions")
        .withIndex("by_source", (query) => query.eq("sourceChunkId", suggestion.sourceChunkId))
        .filter((query) =>
          query.and(
            query.eq(query.field("ownerId"), suggestion.ownerId),
            query.eq(query.field("organizationId"), suggestion.organizationId),
            query.eq(query.field("rationale"), suggestion.rationale),
          ),
        )
        .first();

      if (existing) {
        saved.push({
          id: String(existing._id),
          ownerId: existing.ownerId,
          organizationId: existing.organizationId,
          sourceChunkId: existing.sourceChunkId,
          sourceText: existing.sourceText,
          type: existing.type,
          status: existing.status,
          proposedNode: existing.proposedNode,
          proposedEdge: existing.proposedEdge,
          rationale: existing.rationale,
          confidence: existing.confidence,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
          reviewedAt: existing.reviewedAt,
          reviewedBy: existing.reviewedBy,
          rejectionReason: existing.rejectionReason,
        });
        continue;
      }

      const id = await ctx.db.insert("graphSuggestions", {
        ownerId: suggestion.ownerId,
        organizationId: suggestion.organizationId,
        sourceChunkId: suggestion.sourceChunkId,
        sourceText: suggestion.sourceText,
        type: suggestion.type,
        status: suggestion.status,
        proposedNode: suggestion.proposedNode,
        proposedEdge: suggestion.proposedEdge,
        rationale: suggestion.rationale,
        confidence: suggestion.confidence,
        createdAt: suggestion.createdAt,
        updatedAt: suggestion.updatedAt,
        reviewedAt: suggestion.reviewedAt,
        reviewedBy: suggestion.reviewedBy,
        rejectionReason: suggestion.rejectionReason,
      });

      saved.push({ ...suggestion, id: String(id) });
    }

    return saved;
  },
});

export const approveSuggestion = mutationGeneric({
  args: {
    suggestionId: v.string(),
    reviewedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const suggestion = await ctx.db.get(args.suggestionId as GenericId<"graphSuggestions">);

    if (!suggestion || suggestion.status !== "pending") {
      return null;
    }

    const now = new Date().toISOString();
    const graphId = await ensureGraph(ctx, suggestion.ownerId, suggestion.organizationId);

    if (suggestion.proposedNode) {
      await upsertGraphNode(ctx, graphId, {
        ownerId: suggestion.ownerId,
        organizationId: suggestion.organizationId,
        nodeId: suggestion.proposedNode.id,
        kind: suggestion.proposedNode.kind,
        label: suggestion.proposedNode.label,
        group: 9,
        val: 20,
        desc: suggestion.proposedNode.description,
        properties: suggestion.proposedNode.properties,
        confidence: suggestion.proposedNode.confidence,
      });
    }

    if (suggestion.proposedEdge) {
      await ctx.db.insert("graphEdges", {
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

    await ctx.db.patch(suggestion._id, {
      status: "approved",
      reviewedAt: now,
      reviewedBy: args.reviewedBy,
      updatedAt: now,
    });

    return { id: String(suggestion._id), status: "approved" };
  },
});

export const rejectSuggestion = mutationGeneric({
  args: {
    suggestionId: v.string(),
    reviewedBy: v.string(),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const suggestion = await ctx.db.get(args.suggestionId as GenericId<"graphSuggestions">);

    if (!suggestion || suggestion.status !== "pending") {
      return null;
    }

    const now = new Date().toISOString();
    await ctx.db.patch(suggestion._id, {
      status: "rejected",
      reviewedAt: now,
      reviewedBy: args.reviewedBy,
      rejectionReason: args.rejectionReason,
      updatedAt: now,
    });

    return { id: String(suggestion._id), status: "rejected" };
  },
});

export const searchMemories = queryGeneric({
  args: {
    ownerId: v.string(),
    organizationId: v.string(),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const normalized = args.query.toLowerCase();
    const memories = await ctx.db
      .query("agentMemories")
      .withIndex("by_organization", (query) => query.eq("organizationId", args.organizationId))
      .collect();

    return memories
      .filter((memory) => memory.ownerId === args.ownerId && memory.summary.toLowerCase().includes(normalized))
      .map((memory) => ({
        id: String(memory._id),
        ownerId: memory.ownerId,
        organizationId: memory.organizationId,
        scope: memory.scope,
        summary: memory.summary,
        sourceRunId: memory.sourceRunId,
        retentionPolicy: memory.retentionPolicy,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
      }));
  },
});

export const getSessionItems = queryGeneric({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("agentMessages")
      .withIndex("by_session", (query) => query.eq("sessionId", args.sessionId))
      .collect();

    return messages.map((message) => message.itemJson);
  },
});

export const appendSessionItems = mutationGeneric({
  args: {
    sessionId: v.string(),
    ownerId: v.string(),
    organizationId: v.string(),
    items: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const sessions = await ctx.db
      .query("agentSessions")
      .withIndex("by_session", (query) => query.eq("sessionId", args.sessionId))
      .collect();
    const session = sessions[0];

    if (session) {
      await ctx.db.patch(session._id, { updatedAt: now });
    } else {
      await ctx.db.insert("agentSessions", {
        sessionId: args.sessionId,
        ownerId: args.ownerId,
        organizationId: args.organizationId,
        compactionStatus: "none",
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const item of args.items) {
      await ctx.db.insert("agentMessages", {
        sessionId: args.sessionId,
        ownerId: args.ownerId,
        organizationId: args.organizationId,
        role: "item",
        itemJson: item,
        createdAt: now,
      });
    }
  },
});

export const popSessionItem = mutationGeneric({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("agentMessages")
      .withIndex("by_session", (query) => query.eq("sessionId", args.sessionId))
      .collect();
    const lastMessage = messages.at(-1);

    if (!lastMessage) {
      return null;
    }

    await ctx.db.delete(lastMessage._id);
    return lastMessage.itemJson;
  },
});

export const clearSession = mutationGeneric({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("agentMessages")
      .withIndex("by_session", (query) => query.eq("sessionId", args.sessionId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
  },
});

export const searchChunkEmbeddings = actionGeneric({
  args: {
    organizationId: v.string(),
    embedding: v.array(v.float64()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const results = await ctx.vectorSearch("documentChunks", "by_embedding", {
      vector: args.embedding,
      limit: args.limit,
      filter: (query) => query.eq("organizationId", args.organizationId),
    });

    return results.map((result) => ({
      chunkId: String(result._id),
      score: result._score,
    }));
  },
});

async function ensureGraph(ctx: MutationCtx, ownerId: string, organizationId: string) {
  const graphs = await ctx.db.query("graphs").withIndex("by_owner", (query) => query.eq("ownerId", ownerId)).collect();
  const existing = graphs.find((graph) => graph.name === `${organizationId} Graph-RAG Memory`);

  if (existing) {
    return existing._id as GenericId<"graphs">;
  }

  const now = new Date().toISOString();
  return (await ctx.db.insert("graphs", {
    name: `${organizationId} Graph-RAG Memory`,
    ownerId,
    description: "Convex-backed graph memory for chunk-first Graph-RAG retrieval.",
    createdAt: now,
    updatedAt: now,
  })) as GenericId<"graphs">;
}

async function upsertGraphNode(
  ctx: MutationCtx,
  graphId: GenericId<"graphs">,
  node: {
    ownerId: string;
    organizationId: string;
    nodeId: string;
    kind: "chunk" | "entity" | "concept" | "claim" | "summary" | "community" | "memory";
    label: string;
    group: number;
    val: number;
    desc: string;
    chunkId?: GenericId<"documentChunks">;
    documentId?: GenericId<"documents">;
    properties: Record<string, string>;
    confidence: number;
  },
) {
  const existing = await ctx.db
    .query("graphNodes")
    .withIndex("by_graph", (query) => query.eq("graphId", graphId))
    .filter((query) => query.eq(query.field("nodeId"), node.nodeId))
    .first();

  if (existing) {
    return existing._id;
  }

  const graphNode = {
    graphId,
    ownerId: node.ownerId,
    organizationId: node.organizationId,
    nodeId: node.nodeId,
    kind: node.kind,
    label: node.label,
    group: node.group,
    val: node.val,
    desc: node.desc,
    properties: node.properties,
    confidence: node.confidence,
    ...(node.chunkId ? { chunkId: node.chunkId } : {}),
    ...(node.documentId ? { documentId: node.documentId } : {}),
  };

  return ctx.db.insert("graphNodes", graphNode);
}
