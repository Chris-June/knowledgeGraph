import type { GraphInsightSummary, KnowledgeGraph } from "@/schemas/graph";

export function getGraphAnalytics(graph: KnowledgeGraph): GraphInsightSummary | null {
  if (graph.nodes.length === 0) {
    return null;
  }

  const groups: Record<string, number> = {};
  const degrees = new Map<string, { nodeId: string; degree: number; groupsConnected: Set<number> }>();
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  graph.nodes.forEach((node) => {
    groups[String(node.group)] = (groups[String(node.group)] ?? 0) + 1;
    degrees.set(node.id, { nodeId: node.id, degree: 0, groupsConnected: new Set() });
  });

  graph.links.forEach((link) => {
    const sourceDegree = degrees.get(link.source);
    const targetDegree = degrees.get(link.target);
    const sourceNode = nodeById.get(link.source);
    const targetNode = nodeById.get(link.target);

    if (!sourceDegree || !targetDegree || !sourceNode || !targetNode) {
      return;
    }

    sourceDegree.degree += 1;
    targetDegree.degree += 1;
    sourceDegree.groupsConnected.add(targetNode.group);
    targetDegree.groupsConnected.add(sourceNode.group);
  });

  const rows = Array.from(degrees.values())
    .map((row) => {
      const node = nodeById.get(row.nodeId);
      return node
        ? {
            node,
            degree: row.degree,
            groupsConnected: row.groupsConnected.size,
          }
        : null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return {
    groups,
    hubs: [...rows].sort((a, b) => b.degree - a.degree).slice(0, 5),
    bottlenecks: [...rows].sort((a, b) => b.groupsConnected - a.groupsConnected).slice(0, 5),
  };
}
