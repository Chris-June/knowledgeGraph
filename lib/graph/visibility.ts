import type { KnowledgeGraph } from "@/schemas/graph";

export function getVisibleGraph(graph: KnowledgeGraph, hiddenGroups: Set<number>, collapsedNodes: Set<string>): KnowledgeGraph {
  const allowedNodes = graph.nodes.filter((node) => !hiddenGroups.has(node.group));
  const hiddenNodes = new Set<string>();

  collapsedNodes.forEach((nodeId) => {
    const traverse = (currentId: string) => {
      graph.links.forEach((link) => {
        if (link.source === currentId && !hiddenNodes.has(link.target) && !collapsedNodes.has(link.target)) {
          hiddenNodes.add(link.target);
          traverse(link.target);
        }
      });
    };

    traverse(nodeId);
  });

  const nodes = allowedNodes.filter((node) => !hiddenNodes.has(node.id));
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const links = graph.links.filter((link) => visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target));

  return { nodes, links };
}
