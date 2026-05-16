# Knowledge Graph Platform Build Initialization

## 1. Architecture Diagram

```text
Next.js App Router
  -> Server Components / Client Graph Workspace
  -> Validation Schemas (Zod)
  -> Services
  -> Convex Contracts
  -> AI Orchestrator
  -> Tool Registry
  -> Memory Provider
  -> AIContentRenderer
  -> Remotion Composition Layer
```

## 2. Folder Structure

```text
/app
/components
/components/ai
/components/graph
/components/ui
/lib
/lib/graph
/hooks
/services
/types
/schemas
/agents
/agents/orchestrator
/agents/tools
/agents/memory
/convex
/mcp
/public
/remotion
/styles
```

## 3. Convex Schema Definitions

Convex contracts live in `convex/schema.ts` and define `graphs`, `graphNodes`, `graphLinks`, `graphAuditEvents`, and `aiMemory`.

## 4. AI Orchestration Architecture

AI requests must route through `agents/orchestrator`. The default model family is GPT-5, with `gpt-5-nano` as the default model in `lib/model-config.ts`.

## 5. Tool Registry Design

Tools are registered through `agents/tools/registry.ts` with typed input schemas, execution context, and deterministic tool lookup.

## 6. Memory Architecture Model

Memory is represented by `agents/memory/store.ts` and supports session, contextual, and organizational scopes with structured metadata.

## 7. Environment Variable Schema

Environment validation lives in `schemas/env.ts` and `lib/env.ts`.

Required or reserved variables:
- `APP_ENV`
- `OPENAI_API_KEY`
- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_CONVEX_URL`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_PUBLIC_KEY`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

## 8. Agent Routing Flow

```text
Validated AI Request
  -> Orchestrator
  -> Tool Registry
  -> Structured Response Schema
  -> AIContentRenderer / Service Consumer
```

## 9. Authentication And Authorization Strategy

RBAC is reserved at the Convex/service boundary. Initial local graph state is client-only, while persistent graph mutations must later enforce actor, organization, and graph-level permissions.

## 10. Deployment Topology

Frontend and backend routes deploy through Vercel as a Next.js monorepo-compatible application. Convex remains the required data layer once linked.

## 11. AI Rendering Pipeline Design

All long-form markdown and AI output renders through `components/ai/AIContentRenderer.tsx` with GFM, heading anchors, sanitized HTML, prose styling, code blocks, and copy support.

## 12. Error Handling Strategy

Runtime validation uses Zod. API surfaces return structured JSON. Service errors should be centralized before persistence and AI routes are activated.

## 13. Logging And Observability Plan

Structured logging is centralized in `services/observability.ts`. Future production observability can layer OpenTelemetry, Langfuse, or a custom log drain without changing app boundaries.

## 14. RAG And Vector Strategy

Graph operational data and AI memory remain separated. Future retrieval should index graph content, memory records, and document metadata without mixing deterministic graph mutations with generated model context.

## 15. MCP Integration Readiness

The `/mcp` directory is reserved for future MCP servers, tools, resources, context providers, and orchestration extensions.

## Refactor Boundary

This platform refactor preserves the interactive 2D/3D graph as the first feature. Convex persistence, live AI orchestration, and Remotion production rendering are scaffolded but not activated until architecture approval and environment linking are complete.
