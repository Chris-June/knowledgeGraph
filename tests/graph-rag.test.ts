import assert from "node:assert/strict";
import test from "node:test";

import { ConvexBackedAgentSession } from "@/agents/memory/convex-session";
import { createGraphRagTools } from "@/agents/tools/graph-rag-tools";
import { chunkDocument } from "@/services/graph-rag-ingestion";
import { graphRagRepository } from "@/services/graph-rag-repository";
import { GraphRagRetrievalService } from "@/services/graph-rag-retrieval";
import { GraphRagSuggestionService } from "@/services/graph-rag-suggestions";
import { GraphRagTraceService } from "@/services/graph-rag-traces";

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
  assert.equal(first.chunks[0]?.embedding?.length, 1536);
});

test("retrieval returns chunk nodes, graph expansion, and citations", async () => {
  const service = new GraphRagRetrievalService(graphRagRepository);
  const traceService = new GraphRagTraceService(graphRagRepository);
  const requestId = "test-retrieval-trace";
  const result = await service.retrieve({
    query: "React Node.js SSR",
    ownerId: "test-user",
    organizationId: "test-org",
    requestId,
  });

  assert.ok(result.chunks.length > 0);
  assert.ok(result.nodes.some((row) => row.node.kind === "chunk"));
  assert.ok(result.edges.length > 0);
  assert.ok(result.citations.length > 0);

  const traces = await graphRagRepository.getToolExecutionsByRequest(requestId, "test-user", "test-org");
  assert.ok(traces.some((trace) => trace.toolName === "search_chunks"));
  assert.ok(traces.some((trace) => trace.toolName === "expand_graph"));

  const runs = await traceService.list({ ownerId: "test-user", organizationId: "test-org", limit: 1 });
  assert.equal(runs[0]?.requestId, requestId);

  const trace = await traceService.get({
    runId: runs[0]?.id ?? "",
    ownerId: "test-user",
    organizationId: "test-org",
  });
  assert.ok(trace);
  assert.ok(trace.path.length > 0);
  assert.ok(trace.toolExecutions.some((execution) => execution.toolName === "record_retrieval_trace"));
});

test("document import persists chunks as graph nodes", async () => {
  const chunked = chunkDocument({
    title: "Persistence",
    text: "Convex stores chunks as first-class graph nodes.",
    ownerId: "import-user",
    organizationId: "import-org",
  });
  const imported = await graphRagRepository.saveImportedDocument(chunked);
  const snapshot = await graphRagRepository.getSnapshot("import-user", "import-org");

  assert.equal(imported.chunks.length, 1);
  assert.ok(snapshot.documents.some((document) => document.checksum === chunked.document.checksum));
  assert.ok(snapshot.nodes.some((node) => node.kind === "chunk" && node.chunkId === imported.chunks[0]?.id));
});

test("suggestion review queue approves graph mutations and rejects weak proposals", async () => {
  const suggestionService = new GraphRagSuggestionService(graphRagRepository);
  const chunked = chunkDocument({
    title: "Suggestion Review",
    text: "Convex stores first-class chunk nodes for graph retrieval.",
    ownerId: "curation-user",
    organizationId: "curation-org",
  });
  await graphRagRepository.saveImportedDocument(chunked);

  const suggestions = await suggestionService.propose({
    ownerId: "curation-user",
    organizationId: "curation-org",
    limit: 2,
  });
  const suggestion = suggestions[0];
  assert.ok(suggestion);
  assert.equal(suggestion.status, "pending");

  const approved = await suggestionService.approve({
    suggestionId: suggestion.id,
    reviewedBy: "curator",
  });
  assert.equal(approved?.status, "approved");

  const snapshot = await graphRagRepository.getSnapshot("curation-user", "curation-org");
  assert.ok(snapshot.nodes.some((node) => node.id === suggestion.proposedNode?.id));
  assert.ok(snapshot.edges.some((edge) => edge.targetNodeId === suggestion.proposedEdge?.targetNodeId));

  const moreSuggestions = await suggestionService.propose({
    ownerId: "curation-user",
    organizationId: "curation-org",
    limit: 2,
  });
  const rejectable = moreSuggestions.find((candidate) => candidate.status === "pending");
  if (rejectable) {
    const rejected = await suggestionService.reject({
      suggestionId: rejectable.id,
      reviewedBy: "curator",
      rejectionReason: "test rejection",
    });
    assert.equal(rejected?.status, "rejected");
  }
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
