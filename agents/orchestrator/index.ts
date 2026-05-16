import { Agent, run } from "@openai/agents";
import { z } from "zod";

import { ConvexBackedAgentSession } from "@/agents/memory/convex-session";
import { createGraphRagTools, type GraphRagAgentContext } from "@/agents/tools/graph-rag-tools";
import { defaultModelConfig, gpt5ModelSchema } from "@/lib/model-config";
import {
  agentQueryRequestSchema,
  agentQueryResponseSchema,
  type AgentMemory,
  type AgentQueryRequest,
  type AgentQueryResponse,
  type RetrievalContext,
  type ToolExecution,
} from "@/schemas/graph-rag";
import { graphRagRepository } from "@/services/graph-rag-repository";
import { GraphRagRetrievalService } from "@/services/graph-rag-retrieval";

export const aiRequestSchema = z.object({
  route: z.string().min(1),
  model: gpt5ModelSchema.default(defaultModelConfig.defaultModel),
  input: z.string().min(1),
  metadata: z.record(z.string(), z.string()).default({}),
});

export const aiResponseSchema = z.object({
  route: z.string().min(1),
  model: gpt5ModelSchema,
  output: z.string(),
  citations: z.array(z.string()).default([]),
});

export type AiRequest = z.infer<typeof aiRequestSchema>;
export type AiResponse = z.infer<typeof aiResponseSchema>;

export interface AiOrchestrator {
  run(request: AiRequest): Promise<AiResponse>;
}

export interface AgentRuntime {
  answer(request: AgentQueryRequest): Promise<AgentQueryResponse>;
}

const graphRagTools = createGraphRagTools();

export const retrievalAgent = new Agent<GraphRagAgentContext>({
  name: "RetrievalAgent",
  model: defaultModelConfig.defaultModel,
  instructions: [
    "Plan and execute retrieval against a typed knowledge graph.",
    "Use search_chunks first, then expand_graph or get_neighbors when more graph context is needed.",
    "Return compact retrieval findings with citations and confidence notes.",
  ].join("\n"),
  tools: graphRagTools.filter((tool) =>
    ["search_chunks", "expand_graph", "get_node", "get_neighbors", "record_retrieval_trace"].includes(tool.name),
  ),
});

export const ingestionAgent = new Agent<GraphRagAgentContext>({
  name: "IngestionAgent",
  model: defaultModelConfig.defaultModel,
  instructions: [
    "Prepare documents for graph ingestion.",
    "Chunk deterministically, extract graph facts only through structured tools, and never write unvalidated model output.",
  ].join("\n"),
  tools: graphRagTools.filter((tool) => ["ingest_document", "extract_graph_facts", "record_tool_execution"].includes(tool.name)),
});

export const curationAgent = new Agent<GraphRagAgentContext>({
  name: "CurationAgent",
  model: defaultModelConfig.defaultModel,
  instructions: "Review duplicate entities, weak edges, stale chunks, and low-confidence graph paths. Produce curation recommendations only.",
  tools: graphRagTools.filter((tool) => ["get_node", "get_neighbors", "record_tool_execution"].includes(tool.name)),
});

export const memoryAgent = new Agent<GraphRagAgentContext>({
  name: "MemoryAgent",
  model: defaultModelConfig.defaultModel,
  instructions: "Write and retrieve durable user, project, and organization memories. Keep memories separate from document facts.",
  tools: graphRagTools.filter((tool) => ["write_memory", "search_memory", "record_tool_execution"].includes(tool.name)),
});

export const managerAgent = new Agent<GraphRagAgentContext>({
  name: "ManagerAgent",
  model: defaultModelConfig.defaultModel,
  instructions: [
    "You are the user-facing graph-RAG manager.",
    "Use retrieval tools before answering factual questions.",
    "Answer only from retrieved context unless you clearly state that context is insufficient.",
    "Cite chunk labels when using retrieved evidence.",
    "Keep graph editing separate from graph suggestions unless the user explicitly approves a mutation.",
  ].join("\n"),
  tools: [
    retrievalAgent.asTool({
      toolName: "retrieval_agent",
      toolDescription: "Plans graph-RAG retrieval and returns citation-ready context.",
    }),
    curationAgent.asTool({
      toolName: "curation_agent",
      toolDescription: "Reviews graph quality, duplicate entities, weak edges, and stale context.",
    }),
    memoryAgent.asTool({
      toolName: "memory_agent",
      toolDescription: "Writes and searches durable agent memory.",
    }),
    ...graphRagTools,
  ],
});

export class GraphRagAgentRuntime implements AgentRuntime, AiOrchestrator {
  private readonly retrievalService = new GraphRagRetrievalService(graphRagRepository);

  async run(request: AiRequest): Promise<AiResponse> {
    const parsed = aiRequestSchema.parse(request);
    const answer = await this.answer({
      query: parsed.input,
      ownerId: parsed.metadata.ownerId ?? "local-user",
      organizationId: parsed.metadata.organizationId ?? "local-org",
      sessionId: parsed.metadata.sessionId ?? "local-session",
      useModel: parsed.metadata.useModel === "true",
    });

    return aiResponseSchema.parse({
      route: parsed.route,
      model: parsed.model,
      output: answer.answer,
      citations: answer.retrieval.citations.map((citation) => citation.label),
    });
  }

  async answer(request: AgentQueryRequest): Promise<AgentQueryResponse> {
    const parsed = agentQueryRequestSchema.parse(request);
    const context: GraphRagAgentContext = {
      ownerId: parsed.ownerId,
      organizationId: parsed.organizationId,
      requestId: `request_${Date.now()}`,
    };
    const retrieval = await this.retrievalService.retrieve({
      query: parsed.query,
      ownerId: parsed.ownerId,
      organizationId: parsed.organizationId,
    });
    const memoryWrites: AgentMemory[] = [];
    const toolExecutions: ToolExecution[] = [];

    if (parsed.useModel && process.env.OPENAI_API_KEY) {
      const session = new ConvexBackedAgentSession(parsed.sessionId, graphRagRepository);
      const result = await run(managerAgent, buildManagerInput(parsed.query, retrieval), {
        context,
        session,
        maxTurns: 6,
      });

      return agentQueryResponseSchema.parse({
        answer: String(result.finalOutput ?? ""),
        retrieval,
        toolExecutions,
        memoryWrites,
        sessionId: parsed.sessionId,
        usedModel: true,
      });
    }

    return agentQueryResponseSchema.parse({
      answer: buildDeterministicAnswer(parsed.query, retrieval),
      retrieval,
      toolExecutions,
      memoryWrites,
      sessionId: parsed.sessionId,
      usedModel: false,
    });
  }
}

function buildManagerInput(query: string, retrieval: RetrievalContext) {
  return [
    `User query: ${query}`,
    "",
    "Retrieved context:",
    ...retrieval.chunks.map((row, index) => `${index + 1}. ${row.chunk.text} (score ${row.score.toFixed(2)})`),
    "",
    "Connected graph evidence:",
    ...retrieval.edges.slice(0, 8).map((row) => `${row.edge.type}: ${row.edge.sourceNodeId} -> ${row.edge.targetNodeId}`),
    "",
    "Answer with citations from the retrieved chunks.",
  ].join("\n");
}

function buildDeterministicAnswer(query: string, retrieval: RetrievalContext) {
  const topChunks = retrieval.chunks.slice(0, 3);

  if (topChunks.length === 0) {
    return `I could not retrieve supporting graph context for "${query}".`;
  }

  const evidence = topChunks.map((row) => row.chunk.text).join(" ");
  const labels = retrieval.citations.map((citation) => citation.label).join(", ");

  return `Retrieved ${topChunks.length} supporting chunk node${topChunks.length === 1 ? "" : "s"} for "${query}". ${evidence} Sources: ${labels}.`;
}

export const graphRagAgentRuntime = new GraphRagAgentRuntime();
