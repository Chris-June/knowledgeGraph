# IntelliSync AI-Native Build Protocol

This repository follows the IntelliSync build initialization protocol.

Non-negotiables:
- Next.js App Router, TypeScript strict mode, Tailwind v4, shadcn-compatible primitives, Zustand, Zod, Framer Motion, Convex contracts, OpenAI Agents SDK boundaries, Remotion readiness, and MCP readiness are baseline architecture.
- AI is infrastructure, not decoration. No UI component may call models directly or embed unmanaged prompt strings.
- All long-form AI or markdown output must render through `components/ai/AIContentRenderer.tsx`.
- Service boundaries must remain explicit: route/API -> validation -> service -> data -> AI.
- Convex is the required data layer. This first refactor is contracts-first until the project is linked.
- Remotion is the required programmatic video layer for timeline-based media. Framer Motion remains the runtime UI interaction layer.
- Do not introduce mock production data, unvalidated AI outputs, orphaned prompts, console debugging as a feature, inline secrets, duplicated renderers, or direct database access from routes.

When uncertain, choose maintainability, determinism, typed contracts, and operational clarity.
