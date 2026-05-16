import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  graphs: defineTable({
    name: v.string(),
    ownerId: v.string(),
    description: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_owner", ["ownerId"]),
  graphNodes: defineTable({
    graphId: v.id("graphs"),
    nodeId: v.string(),
    group: v.number(),
    val: v.number(),
    desc: v.string(),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    z: v.optional(v.number()),
    fx: v.optional(v.number()),
    fy: v.optional(v.number()),
    fz: v.optional(v.number()),
  })
    .index("by_graph", ["graphId"])
    .index("by_graph_node", ["graphId", "nodeId"]),
  graphLinks: defineTable({
    graphId: v.id("graphs"),
    source: v.string(),
    target: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("default"),
      v.literal("dependency"),
      v.literal("part_of"),
      v.literal("tooling"),
      v.literal("core"),
      v.literal("related"),
    ),
    weight: v.number(),
    pairId: v.optional(v.string()),
    curvature: v.number(),
  }).index("by_graph", ["graphId"]),
  graphAuditEvents: defineTable({
    graphId: v.id("graphs"),
    actorId: v.string(),
    action: v.string(),
    metadata: v.record(v.string(), v.string()),
    createdAt: v.string(),
  }).index("by_graph", ["graphId"]),
  aiMemory: defineTable({
    ownerId: v.string(),
    scope: v.union(v.literal("session"), v.literal("contextual"), v.literal("organizational")),
    content: v.string(),
    metadata: v.record(v.string(), v.string()),
    createdAt: v.string(),
  }).index("by_owner_scope", ["ownerId", "scope"]),
});
