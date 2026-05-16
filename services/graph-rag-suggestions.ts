import {
  graphSuggestionSchema,
  type GraphSuggestion,
  type GraphSuggestionStatus,
} from "@/schemas/graph-rag";

import type { GraphRagRepository, GraphRagSnapshot } from "./graph-rag-repository";

type SuggestionInput = {
  ownerId: string;
  organizationId: string;
  limit?: number;
};

type ReviewInput = {
  suggestionId: string;
  reviewedBy: string;
  rejectionReason?: string;
};

export class GraphRagSuggestionService {
  constructor(private readonly repository: GraphRagRepository) {}

  async list(ownerId: string, organizationId: string, status: GraphSuggestionStatus = "pending") {
    return this.repository.listSuggestions(ownerId, organizationId, status);
  }

  async propose(input: SuggestionInput) {
    const limit = input.limit ?? 8;
    const snapshot = await this.repository.getSnapshot(input.ownerId, input.organizationId);
    const existing = await this.repository.listSuggestions(input.ownerId, input.organizationId);
    const suggestions = snapshot.chunks
      .filter((chunk) => chunk.visible)
      .map((chunk) => buildEntitySuggestion(snapshot, chunk.id, chunk.text, input.ownerId, input.organizationId))
      .filter((suggestion): suggestion is GraphSuggestion => Boolean(suggestion))
      .filter((suggestion) => !existing.some((candidate) => candidate.rationale === suggestion.rationale))
      .slice(0, limit);

    if (suggestions.length === 0) {
      return this.repository.listSuggestions(input.ownerId, input.organizationId, "pending");
    }

    return this.repository.saveSuggestions(suggestions);
  }

  async approve(input: ReviewInput) {
    return this.repository.approveSuggestion(input.suggestionId, input.reviewedBy);
  }

  async reject(input: ReviewInput) {
    return this.repository.rejectSuggestion(input.suggestionId, input.reviewedBy, input.rejectionReason);
  }
}

function buildEntitySuggestion(
  snapshot: GraphRagSnapshot,
  chunkId: string,
  chunkText: string,
  ownerId: string,
  organizationId: string,
) {
  const sourceNode = snapshot.nodes.find((node) => node.kind === "chunk" && node.chunkId === chunkId);
  const label = extractEntityLabel(chunkText);

  if (!sourceNode || !label) {
    return null;
  }

  const targetNodeId = `node_entity_${slugify(label)}`;
  const existingNode = snapshot.nodes.find((node) => node.id === targetNodeId || node.label.toLowerCase() === label.toLowerCase());

  if (existingNode) {
    const claimNodeId = `node_claim_${slugify(chunkId)}`;
    if (snapshot.nodes.some((node) => node.id === claimNodeId)) {
      return null;
    }

    const now = new Date().toISOString();
    return graphSuggestionSchema.parse({
      id: `suggestion_${slugify(chunkId)}_claim`,
      ownerId,
      organizationId,
      sourceChunkId: chunkId,
      sourceText: chunkText,
      type: "claim",
      status: "pending",
      proposedNode: {
        id: claimNodeId,
        kind: "claim",
        label: `${label} claim`,
        description: truncate(chunkText, 180),
        properties: {
          extraction: "deterministic_v1",
        },
        confidence: 0.68,
      },
      proposedEdge: {
        sourceNodeId: sourceNode.id,
        targetNodeId: claimNodeId,
        type: "SUPPORTS",
        provenance: `Claim supported by source chunk ${chunkId}`,
        confidence: 0.76,
      },
      rationale: `Create a claim node supported by source chunk ${chunkId}.`,
      confidence: 0.7,
      createdAt: now,
      updatedAt: now,
    });
  }

  const now = new Date().toISOString();
  return graphSuggestionSchema.parse({
    id: `suggestion_${slugify(chunkId)}_${slugify(label)}`,
    ownerId,
    organizationId,
    sourceChunkId: chunkId,
    sourceText: chunkText,
    type: "entity",
    status: "pending",
    proposedNode: {
      id: targetNodeId,
      kind: "entity",
      label,
      description: `Entity extracted from chunk: ${truncate(chunkText, 140)}`,
      properties: {
        extraction: "deterministic_v1",
      },
      confidence: 0.74,
    },
    proposedEdge: {
      sourceNodeId: sourceNode.id,
      targetNodeId,
      type: "MENTIONS",
      provenance: `Mentioned in source chunk ${chunkId}`,
      confidence: 0.82,
    },
    rationale: `Create entity "${label}" from source chunk ${chunkId}.`,
    confidence: 0.78,
    createdAt: now,
    updatedAt: now,
  });
}

function extractEntityLabel(text: string) {
  const firstSentence = text.split(/[.!?]/)[0]?.trim() ?? "";
  const withoutLeadingLabel = firstSentence.includes(".") ? firstSentence.split(".").at(-1)?.trim() ?? firstSentence : firstSentence;
  const capitalized = withoutLeadingLabel.match(/\b[A-Z][A-Za-z0-9.-]{2,}(?:\s+[A-Z][A-Za-z0-9.-]{2,}){0,2}\b/u)?.[0];

  if (capitalized) {
    return capitalized;
  }

  const words = withoutLeadingLabel
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 2);

  return words.length > 0 ? words.map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ") : null;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}
