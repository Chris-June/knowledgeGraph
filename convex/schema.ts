import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  documents: defineTable({
    ownerId: v.string(),
    organizationId: v.string(),
    title: v.string(),
    sourceType: v.union(v.literal("text"), v.literal("markdown"), v.literal("pdf"), v.literal("url"), v.literal("upload")),
    checksum: v.string(),
    status: v.union(v.literal("queued"), v.literal("processing"), v.literal("ready"), v.literal("failed")),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_organization", ["organizationId"])
    .index("by_checksum", ["checksum"]),
  documentChunks: defineTable({
    documentId: v.id("documents"),
    ownerId: v.string(),
    organizationId: v.string(),
    text: v.string(),
    tokenCount: v.number(),
    sourceSpan: v.object({
      start: v.number(),
      end: v.number(),
    }),
    embedding: v.array(v.float64()),
    visible: v.boolean(),
    version: v.number(),
    createdAt: v.string(),
  })
    .index("by_document", ["documentId"])
    .index("by_owner", ["ownerId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["organizationId", "visible"],
    }),
  graphs: defineTable({
    name: v.string(),
    ownerId: v.string(),
    description: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_owner", ["ownerId"]),
  graphNodes: defineTable({
    graphId: v.id("graphs"),
    ownerId: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    nodeId: v.string(),
    kind: v.optional(
      v.union(
        v.literal("chunk"),
        v.literal("entity"),
        v.literal("concept"),
        v.literal("claim"),
        v.literal("summary"),
        v.literal("community"),
        v.literal("memory"),
      ),
    ),
    label: v.optional(v.string()),
    group: v.number(),
    val: v.number(),
    desc: v.string(),
    chunkId: v.optional(v.id("documentChunks")),
    documentId: v.optional(v.id("documents")),
    properties: v.optional(v.record(v.string(), v.string())),
    confidence: v.optional(v.number()),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    z: v.optional(v.number()),
    fx: v.optional(v.number()),
    fy: v.optional(v.number()),
    fz: v.optional(v.number()),
  })
    .index("by_graph", ["graphId"])
    .index("by_graph_node", ["graphId", "nodeId"]),
  graphLinks: defineTable({
    graphId: v.id("graphs"),
    source: v.string(),
    target: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("default"),
      v.literal("dependency"),
      v.literal("part_of"),
      v.literal("tooling"),
      v.literal("core"),
      v.literal("related"),
    ),
    weight: v.number(),
    pairId: v.optional(v.string()),
    curvature: v.number(),
  }).index("by_graph", ["graphId"]),
  graphEdges: defineTable({
    ownerId: v.string(),
    organizationId: v.string(),
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
    confidence: v.number(),
    extractionRunId: v.optional(v.string()),
    sourceChunkIds: v.array(v.string()),
    provenance: v.string(),
    createdAt: v.string(),
  })
    .index("by_source", ["sourceNodeId"])
    .index("by_target", ["targetNodeId"])
    .index("by_org_type", ["organizationId", "type"]),
  importRuns: defineTable({
    ownerId: v.string(),
    organizationId: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("chunking"),
      v.literal("extracting"),
      v.literal("indexing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    model: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_org_status", ["organizationId", "status"]),
  retrievalRuns: defineTable({
    ownerId: v.string(),
    organizationId: v.string(),
    query: v.string(),
    strategy: v.union(v.literal("local_graph"), v.literal("vector_graph"), v.literal("entity_graph"), v.literal("memory_graph")),
    retrievedNodeIds: v.array(v.string()),
    retrievedChunkIds: v.array(v.string()),
    confidence: v.number(),
    citations: v.array(
      v.object({
        chunkId: v.string(),
        documentId: v.string(),
        label: v.string(),
        sourceSpan: v.object({
          start: v.number(),
          end: v.number(),
        }),
        quote: v.string(),
      }),
    ),
    createdAt: v.string(),
  }).index("by_org", ["organizationId"]),
  agentSessions: defineTable({
    sessionId: v.string(),
    ownerId: v.string(),
    organizationId: v.string(),
    compactionStatus: v.union(v.literal("none"), v.literal("pending"), v.literal("compacted"), v.literal("failed")),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_session", ["sessionId"])
    .index("by_owner", ["ownerId"]),
  agentMessages: defineTable({
    sessionId: v.string(),
    ownerId: v.string(),
    organizationId: v.string(),
    role: v.string(),
    itemJson: v.string(),
    createdAt: v.string(),
  }).index("by_session", ["sessionId"]),
  agentMemories: defineTable({
    ownerId: v.string(),
    organizationId: v.string(),
    scope: v.union(v.literal("short"), v.literal("medium"), v.literal("long")),
    summary: v.string(),
    sourceRunId: v.optional(v.string()),
    retentionPolicy: v.union(v.literal("session"), v.literal("project"), v.literal("organization")),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_owner_scope", ["ownerId", "scope"]),
  toolExecutions: defineTable({
    ownerId: v.string(),
    organizationId: v.string(),
    toolName: v.string(),
    argsHash: v.string(),
    resultSummary: v.string(),
    latencyMs: v.number(),
    success: v.boolean(),
    error: v.optional(v.string()),
    createdAt: v.string(),
  }).index("by_org_tool", ["organizationId", "toolName"]),
  graphAuditEvents: defineTable({
    graphId: v.id("graphs"),
    actorId: v.string(),
    action: v.string(),
    metadata: v.record(v.string(), v.string()),
    createdAt: v.string(),
  }).index("by_graph", ["graphId"]),
  aiMemory: defineTable({
    ownerId: v.string(),
    scope: v.union(v.literal("session"), v.literal("contextual"), v.literal("organizational")),
    content: v.string(),
    metadata: v.record(v.string(), v.string()),
    createdAt: v.string(),
  }).index("by_owner_scope", ["ownerId", "scope"]),
});
