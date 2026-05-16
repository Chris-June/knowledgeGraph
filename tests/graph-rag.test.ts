import assert from "node:assert/strict";
import test from "node:test";

import { ConvexBackedAgentSession } from "@/agents/memory/convex-session";
import { createGraphRagTools } from "@/agents/tools/graph-rag-tools";
import { chunkDocument } from "@/services/graph-rag-ingestion";
import { graphRagRepository } from "@/services/graph-rag-repository";
import { GraphRagRetrievalService } from "@/services/graph-rag-retrieval";

test("chunking is deterministic for the same document text", () => {
  const first = chunkDocument({
    title: "Determinism",
    text: "Alpha connects to beta.\n\nGamma depends on delta.",
    ownerId: "test-user",
    organizationId: "test-org",
  });
  const second = chunkDocument({
    title: "Determinism",
    text: "Alpha connects to beta.\n\nGamma depends on delta.",
    ownerId: "test-user",
    organizationId: "test-org",
  });

  assert.equal(first.document.id, second.document.id);
  assert.deepEqual(
    first.chunks.map((chunk) => chunk.id),
    second.chunks.map((chunk) => chunk.id),
  );
});

test("retrieval returns chunk nodes, graph expansion, and citations", async () => {
  const service = new GraphRagRetrievalService(graphRagRepository);
  const result = await service.retrieve({
    query: "React Node.js SSR",
    ownerId: "test-user",
    organizationId: "test-org",
  });

  assert.ok(result.chunks.length > 0);
  assert.ok(result.nodes.some((row) => row.node.kind === "chunk"));
  assert.ok(result.edges.length > 0);
  assert.ok(result.citations.length > 0);
});

test("agent session repository persists and clears items by session", async () => {
  const session = new ConvexBackedAgentSession("test-session", graphRagRepository);

  await session.clearSession();
  await session.addItems([{ role: "user", content: "hello" }]);

  const items = await session.getItems();
  assert.equal(items.length, 1);
  assert.ok(items[0]);

  await session.clearSession();
  assert.equal((await session.getItems()).length, 0);
});

test("graph rag tools are registered with the required names", () => {
  const tools = createGraphRagTools();
  const names = new Set(tools.map((tool) => tool.name));

  [
    "search_chunks",
    "expand_graph",
    "get_node",
    "get_neighbors",
    "ingest_document",
    "extract_graph_facts",
    "write_memory",
    "search_memory",
    "record_retrieval_trace",
    "record_tool_execution",
  ].forEach((name) => assert.ok(names.has(name), `${name} missing`));
});
