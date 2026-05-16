import { z } from "zod";

export const graphNodeKindSchema = z.enum(["chunk", "entity", "concept", "claim", "summary", "community", "memory"]);

export const graphEdgeTypeSchema = z.enum([
  "MENTIONS",
  "SUPPORTS",
  "DERIVED_FROM",
  "RELATES_TO",
  "CAUSES",
  "DEPENDS_ON",
  "PART_OF",
  "CONTRADICTS",
  "SAME_AS",
]);

export const sourceSpanSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});

export const documentRecordSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  organizationId: z.string().min(1),
  title: z.string().min(1),
  sourceType: z.enum(["text", "markdown", "pdf", "url", "upload"]),
  checksum: z.string().min(1),
  status: z.enum(["queued", "processing", "ready", "failed"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const documentChunkSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
  ownerId: z.string().min(1),
  organizationId: z.string().min(1),
  text: z.string().min(1),
  tokenCount: z.number().int().nonnegative(),
  sourceSpan: sourceSpanSchema,
  embedding: z.array(z.number()).optional(),
  visible: z.boolean().default(true),
  version: z.number().int().positive().default(1),
  createdAt: z.string().datetime(),
});

export const ragGraphNodeSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  organizationId: z.string().min(1),
  kind: graphNodeKindSchema,
  label: z.string().min(1),
  description: z.string().default(""),
  chunkId: z.string().optional(),
  documentId: z.string().optional(),
  properties: z.record(z.string(), z.string()).default({}),
  confidence: z.number().min(0).max(1).default(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ragGraphEdgeSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  organizationId: z.string().min(1),
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  type: graphEdgeTypeSchema,
  confidence: z.number().min(0).max(1),
  extractionRunId: z.string().optional(),
  sourceChunkIds: z.array(z.string()).default([]),
  provenance: z.string().default(""),
  createdAt: z.string().datetime(),
});

export const importRunSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  organizationId: z.string().min(1),
  status: z.enum(["queued", "chunking", "extracting", "indexing", "ready", "failed"]),
  model: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const retrievalStrategySchema = z.enum(["local_graph", "vector_graph", "entity_graph", "memory_graph"]);

export const retrievalCitationSchema = z.object({
  chunkId: z.string().min(1),
  documentId: z.string().min(1),
  label: z.string().min(1),
  sourceSpan: sourceSpanSchema,
  quote: z.string().min(1),
});

export const retrievedChunkSchema = z.object({
  chunk: documentChunkSchema,
  score: z.number(),
  reasons: z.array(z.string()).default([]),
});

export const retrievedNodeSchema = z.object({
  node: ragGraphNodeSchema,
  score: z.number(),
  distance: z.number().int().nonnegative(),
});

export const retrievedEdgeSchema = z.object({
  edge: ragGraphEdgeSchema,
  score: z.number(),
});

export const retrievalContextSchema = z.object({
  query: z.string().min(1),
  strategy: retrievalStrategySchema,
  chunks: z.array(retrievedChunkSchema),
  nodes: z.array(retrievedNodeSchema),
  edges: z.array(retrievedEdgeSchema),
  citations: z.array(retrievalCitationSchema),
  coverageNotes: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
});

export const retrievalRunSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  organizationId: z.string().min(1),
  query: z.string().min(1),
  strategy: retrievalStrategySchema,
  retrievedNodeIds: z.array(z.string()),
  retrievedChunkIds: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  citations: z.array(retrievalCitationSchema),
  createdAt: z.string().datetime(),
});

export const agentMemorySchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  organizationId: z.string().min(1),
  scope: z.enum(["short", "medium", "long"]),
  summary: z.string().min(1),
  sourceRunId: z.string().optional(),
  retentionPolicy: z.enum(["session", "project", "organization"]).default("project"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const toolExecutionSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  organizationId: z.string().min(1),
  requestId: z.string().min(1).optional(),
  toolName: z.string().min(1),
  argsHash: z.string().min(1),
  resultSummary: z.string().default(""),
  latencyMs: z.number().int().nonnegative(),
  success: z.boolean(),
  error: z.string().optional(),
  createdAt: z.string().datetime(),
});

export const graphSuggestionStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const graphSuggestionTypeSchema = z.enum(["entity", "concept", "claim", "edge"]);

export const proposedGraphNodeSchema = z.object({
  id: z.string().min(1),
  kind: graphNodeKindSchema,
  label: z.string().min(1),
  description: z.string().default(""),
  properties: z.record(z.string(), z.string()).default({}),
  confidence: z.number().min(0).max(1),
});

export const proposedGraphEdgeSchema = z.object({
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  type: graphEdgeTypeSchema,
  provenance: z.string().default(""),
  confidence: z.number().min(0).max(1),
});

export const graphSuggestionSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  organizationId: z.string().min(1),
  sourceChunkId: z.string().min(1),
  sourceText: z.string().min(1),
  type: graphSuggestionTypeSchema,
  status: graphSuggestionStatusSchema,
  proposedNode: proposedGraphNodeSchema.optional(),
  proposedEdge: proposedGraphEdgeSchema.optional(),
  rationale: z.string().min(1),
  confidence: z.number().min(0).max(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  reviewedAt: z.string().datetime().optional(),
  reviewedBy: z.string().min(1).optional(),
  rejectionReason: z.string().optional(),
});

export const agentQueryRequestSchema = z.object({
  query: z.string().min(1),
  ownerId: z.string().min(1).default("local-user"),
  organizationId: z.string().min(1).default("local-org"),
  sessionId: z.string().min(1).default("local-session"),
  useModel: z.boolean().default(false),
});

export const agentQueryResponseSchema = z.object({
  answer: z.string(),
  retrieval: retrievalContextSchema,
  toolExecutions: z.array(toolExecutionSchema),
  memoryWrites: z.array(agentMemorySchema),
  sessionId: z.string().min(1),
  usedModel: z.boolean(),
});

export type GraphNodeKind = z.infer<typeof graphNodeKindSchema>;
export type GraphEdgeType = z.infer<typeof graphEdgeTypeSchema>;
export type DocumentRecord = z.infer<typeof documentRecordSchema>;
export type DocumentChunk = z.infer<typeof documentChunkSchema>;
export type RagGraphNode = z.infer<typeof ragGraphNodeSchema>;
export type RagGraphEdge = z.infer<typeof ragGraphEdgeSchema>;
export type ImportRun = z.infer<typeof importRunSchema>;
export type RetrievalStrategy = z.infer<typeof retrievalStrategySchema>;
export type RetrievalCitation = z.infer<typeof retrievalCitationSchema>;
export type RetrievalContext = z.infer<typeof retrievalContextSchema>;
export type RetrievalRun = z.infer<typeof retrievalRunSchema>;
export type AgentMemory = z.infer<typeof agentMemorySchema>;
export type ToolExecution = z.infer<typeof toolExecutionSchema>;
export type GraphSuggestionStatus = z.infer<typeof graphSuggestionStatusSchema>;
export type GraphSuggestionType = z.infer<typeof graphSuggestionTypeSchema>;
export type ProposedGraphNode = z.infer<typeof proposedGraphNodeSchema>;
export type ProposedGraphEdge = z.infer<typeof proposedGraphEdgeSchema>;
export type GraphSuggestion = z.infer<typeof graphSuggestionSchema>;
export type AgentQueryRequest = z.infer<typeof agentQueryRequestSchema>;
export type AgentQueryResponse = z.infer<typeof agentQueryResponseSchema>;

export type GraphRagImportResult = {
  document: DocumentRecord;
  chunks: DocumentChunk[];
  importRun: ImportRun;
};

export type VectorChunkMatch = {
  chunkId: string;
  score: number;
};
