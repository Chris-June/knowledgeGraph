import { createHash } from "node:crypto";

import { tool, type FunctionTool } from "@openai/agents";
import { z } from "zod";

import { retrievalContextSchema, type ToolExecution } from "@/schemas/graph-rag";
import { chunkDocument } from "@/services/graph-rag-ingestion";
import { graphRagRepository } from "@/services/graph-rag-repository";
import { GraphRagRetrievalService } from "@/services/graph-rag-retrieval";

export type GraphRagAgentContext = {
  ownerId: string;
  organizationId: string;
  requestId: string;
};

const scopedQuerySchema = z.object({
  query: z.string().min(1),
  maxChunks: z.number().int().positive().max(12).default(5),
});

const expandGraphSchema = z.object({
  nodeIds: z.array(z.string().min(1)).min(1),
  maxHops: z.number().int().min(1).max(3).default(2),
});

const nodeLookupSchema = z.object({
  nodeId: z.string().min(1),
});

const memoryWriteSchema = z.object({
  summary: z.string().min(1),
  scope: z.enum(["short", "medium", "long"]).default("medium"),
});

const memorySearchSchema = z.object({
  query: z.string().min(1),
});

const retrievalTraceSchema = z.object({
  query: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

const ingestDocumentSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
});

const extractGraphFactsSchema = z.object({
  chunkIds: z.array(z.string().min(1)).min(1),
});

function hashArgs(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

async function traceTool(
  context: GraphRagAgentContext | undefined,
  toolName: string,
  input: unknown,
  startedAt: number,
  success: boolean,
  resultSummary: string,
  error?: string,
) {
  const execution: ToolExecution = {
    id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ownerId: context?.ownerId ?? "local-user",
    organizationId: context?.organizationId ?? "local-org",
    toolName,
    argsHash: hashArgs(input),
    resultSummary,
    latencyMs: Date.now() - startedAt,
    success,
    error,
    createdAt: new Date().toISOString(),
  };

  await graphRagRepository.saveToolExecution(execution);
  return execution;
}

export function createGraphRagTools(): FunctionTool<GraphRagAgentContext, typeof scopedQuerySchema | typeof expandGraphSchema | typeof nodeLookupSchema | typeof memoryWriteSchema | typeof memorySearchSchema | typeof retrievalTraceSchema | typeof ingestDocumentSchema | typeof extractGraphFactsSchema, unknown>[] {
  const retrievalService = new GraphRagRetrievalService(graphRagRepository);

  return [
    tool({
      name: "ingest_document",
      description: "Deterministically chunk a document before graph extraction and persistence.",
      parameters: ingestDocumentSchema,
      strict: true,
      execute: async (input, runContext) => {
        const startedAt = Date.now();
        const context = runContext?.context;
        const result = chunkDocument({
          title: input.title,
          text: input.text,
          ownerId: context?.ownerId ?? "local-user",
          organizationId: context?.organizationId ?? "local-org",
        });
        await traceTool(context, "ingest_document", { title: input.title }, startedAt, true, `${result.chunks.length} chunks`);
        return result;
      },
    }),
    tool({
      name: "extract_graph_facts",
      description: "Return the extraction contract for selected chunks. Model-generated facts must be validated before persistence.",
      parameters: extractGraphFactsSchema,
      strict: true,
      execute: async (input, runContext) => {
        const startedAt = Date.now();
        const context = runContext?.context;
        const snapshot = await graphRagRepository.getSnapshot(context?.ownerId ?? "local-user", context?.organizationId ?? "local-org");
        const chunks = snapshot.chunks.filter((chunk) => input.chunkIds.includes(chunk.id));
        const candidateFacts = chunks.map((chunk) => ({
          chunkId: chunk.id,
          proposedNodeLabel: chunk.text.split(".")[0] ?? chunk.id,
          proposedEdgeTypes: ["MENTIONS", "DERIVED_FROM"],
        }));
        await traceTool(context, "extract_graph_facts", input, startedAt, true, `${candidateFacts.length} candidate facts`);
        return { candidateFacts, validationRequired: true };
      },
    }),
    tool({
      name: "search_chunks",
      description: "Search document chunks and return citation-ready graph retrieval context.",
      parameters: scopedQuerySchema,
      strict: true,
      execute: async (input, runContext) => {
        const startedAt = Date.now();
        const context = runContext?.context;
        const retrieval = await retrievalService.retrieve({
          query: input.query,
          ownerId: context?.ownerId ?? "local-user",
          organizationId: context?.organizationId ?? "local-org",
          maxChunks: input.maxChunks,
        });
        await traceTool(context, "search_chunks", input, startedAt, true, `${retrieval.chunks.length} chunks`);
        return retrievalContextSchema.parse(retrieval);
      },
    }),
    tool({
      name: "expand_graph",
      description: "Expand from known graph node IDs and return connected edges and nodes.",
      parameters: expandGraphSchema,
      strict: true,
      execute: async (input, runContext) => {
        const startedAt = Date.now();
        const context = runContext?.context;
        const snapshot = await graphRagRepository.getSnapshot(context?.ownerId ?? "local-user", context?.organizationId ?? "local-org");
        const nodeIds = new Set(input.nodeIds);
        const edges = snapshot.edges.filter((edge) => nodeIds.has(edge.sourceNodeId) || nodeIds.has(edge.targetNodeId));
        const expandedNodeIds = new Set([...input.nodeIds, ...edges.flatMap((edge) => [edge.sourceNodeId, edge.targetNodeId])]);
        const nodes = snapshot.nodes.filter((node) => expandedNodeIds.has(node.id));
        await traceTool(context, "expand_graph", input, startedAt, true, `${nodes.length} nodes`);
        return { nodes, edges, maxHops: input.maxHops };
      },
    }),
    tool({
      name: "get_node",
      description: "Fetch a graph node by ID.",
      parameters: nodeLookupSchema,
      strict: true,
      execute: async (input, runContext) => {
        const startedAt = Date.now();
        const context = runContext?.context;
        const snapshot = await graphRagRepository.getSnapshot(context?.ownerId ?? "local-user", context?.organizationId ?? "local-org");
        const node = snapshot.nodes.find((candidate) => candidate.id === input.nodeId) ?? null;
        await traceTool(context, "get_node", input, startedAt, Boolean(node), node ? node.label : "not found");
        return { node };
      },
    }),
    tool({
      name: "get_neighbors",
      description: "Fetch immediate graph neighbors for a graph node.",
      parameters: nodeLookupSchema,
      strict: true,
      execute: async (input, runContext) => {
        const startedAt = Date.now();
        const context = runContext?.context;
        const snapshot = await graphRagRepository.getSnapshot(context?.ownerId ?? "local-user", context?.organizationId ?? "local-org");
        const edges = snapshot.edges.filter((edge) => edge.sourceNodeId === input.nodeId || edge.targetNodeId === input.nodeId);
        const nodeIds = new Set(edges.flatMap((edge) => [edge.sourceNodeId, edge.targetNodeId]));
        const nodes = snapshot.nodes.filter((node) => node.id !== input.nodeId && nodeIds.has(node.id));
        await traceTool(context, "get_neighbors", input, startedAt, true, `${nodes.length} neighbors`);
        return { nodes, edges };
      },
    }),
    tool({
      name: "write_memory",
      description: "Persist an agent memory separate from graph facts.",
      parameters: memoryWriteSchema,
      strict: true,
      execute: async (input, runContext) => {
        const startedAt = Date.now();
        const context = runContext?.context;
        const now = new Date().toISOString();
        const memory = {
          id: `memory_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          ownerId: context?.ownerId ?? "local-user",
          organizationId: context?.organizationId ?? "local-org",
          scope: input.scope,
          summary: input.summary,
          retentionPolicy: input.scope === "short" ? "session" : "project",
          createdAt: now,
          updatedAt: now,
        } as const;
        await graphRagRepository.saveMemory(memory);
        await traceTool(context, "write_memory", input, startedAt, true, memory.summary);
        return memory;
      },
    }),
    tool({
      name: "search_memory",
      description: "Search agent memories without treating them as document facts.",
      parameters: memorySearchSchema,
      strict: true,
      execute: async (input, runContext) => {
        const startedAt = Date.now();
        const context = runContext?.context;
        const memories = await graphRagRepository.searchMemories(
          context?.ownerId ?? "local-user",
          context?.organizationId ?? "local-org",
          input.query,
        );
        await traceTool(context, "search_memory", input, startedAt, true, `${memories.length} memories`);
        return { memories };
      },
    }),
    tool({
      name: "record_retrieval_trace",
      description: "Record a retrieval trace summary for auditability.",
      parameters: retrievalTraceSchema,
      strict: true,
      execute: async (input, runContext) => {
        const startedAt = Date.now();
        const context = runContext?.context;
        const execution = await traceTool(context, "record_retrieval_trace", input, startedAt, true, input.query);
        return { recorded: true, executionId: execution.id };
      },
    }),
    tool({
      name: "record_tool_execution",
      description: "Record that a deterministic tool execution occurred.",
      parameters: retrievalTraceSchema,
      strict: true,
      execute: async (input, runContext) => {
        const startedAt = Date.now();
        const context = runContext?.context;
        const execution = await traceTool(context, "record_tool_execution", input, startedAt, true, input.query);
        return { recorded: true, executionId: execution.id };
      },
    }),
  ];
}
