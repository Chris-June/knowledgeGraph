import { NextResponse } from "next/server";

import { graphRagAgentRuntime } from "@/agents/orchestrator";
import { agentQueryRequestSchema } from "@/schemas/graph-rag";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = agentQueryRequestSchema.parse(body);
  const response = await graphRagAgentRuntime.answer(parsed);

  return NextResponse.json(response);
}
