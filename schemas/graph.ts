import { z } from "zod";

export const graphNodeSchema = z.object({
  id: z.string().min(1),
  group: z.number().int().nonnegative(),
  val: z.number().positive(),
  desc: z.string().default(""),
  x: z.number().optional(),
  y: z.number().optional(),
  z: z.number().optional(),
  fx: z.number().optional(),
  fy: z.number().optional(),
  fz: z.number().optional(),
});

export const graphLinkTypeSchema = z.enum(["default", "dependency", "part_of", "tooling", "core", "related"]);

export const graphLinkSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  name: z.string().default("related"),
  type: graphLinkTypeSchema.default("default"),
  weight: z.number().positive().default(2),
  pairId: z.string().optional(),
  curvature: z.number().default(0),
});

export const knowledgeGraphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  links: z.array(graphLinkSchema),
});

export const graphViewPreferencesSchema = z.object({
  is3D: z.boolean().default(false),
  chargeStrength: z.number().min(-300).max(0).default(-80),
  linkDistance: z.number().min(10).max(200).default(60),
  dagMode: z.enum(["", "td", "bu", "lr", "rl", "radialout", "radialin"]).default(""),
  showLabels: z.boolean().default(true),
});

export const graphInsightSummarySchema = z.object({
  groups: z.record(z.string(), z.number()),
  hubs: z.array(
    z.object({
      node: graphNodeSchema,
      degree: z.number(),
      groupsConnected: z.number(),
    }),
  ),
  bottlenecks: z.array(
    z.object({
      node: graphNodeSchema,
      degree: z.number(),
      groupsConnected: z.number(),
    }),
  ),
});

export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphLinkType = z.infer<typeof graphLinkTypeSchema>;
export type GraphLink = z.infer<typeof graphLinkSchema>;
export type KnowledgeGraph = z.infer<typeof knowledgeGraphSchema>;
export type GraphViewPreferences = z.infer<typeof graphViewPreferencesSchema>;
export type GraphInsightSummary = z.infer<typeof graphInsightSummarySchema>;

export type RuntimeGraphLink = Omit<GraphLink, "source" | "target" | "pairId" | "curvature"> &
  Partial<Pick<GraphLink, "pairId" | "curvature">> & {
  source: string | GraphNode;
  target: string | GraphNode;
};

export type RuntimeKnowledgeGraph = {
  nodes: GraphNode[];
  links: RuntimeGraphLink[];
};
