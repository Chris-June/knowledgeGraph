import type { GraphLink } from "@/schemas/graph";

type PathResult = {
  pathNodes: string[];
  pathLinks: GraphLink[];
};

export function findShortestPath(startId: string, targetId: string, links: GraphLink[]): PathResult | null {
  const adjacencyList = new Map<string, { node: string; link: GraphLink }[]>();

  links.forEach((link) => {
    const sourceLinks = adjacencyList.get(link.source) ?? [];
    sourceLinks.push({ node: link.target, link });
    adjacencyList.set(link.source, sourceLinks);

    const targetLinks = adjacencyList.get(link.target) ?? [];
    targetLinks.push({ node: link.source, link });
    adjacencyList.set(link.target, targetLinks);
  });

  const queue: string[][] = [[startId]];
  const visited = new Set([startId]);
  const paths = new Map<string, PathResult>([[startId, { pathNodes: [startId], pathLinks: [] }]]);

  while (queue.length > 0) {
    const currentPath = queue.shift();
    const currentNode = currentPath?.[currentPath.length - 1];

    if (!currentPath || !currentNode) {
      continue;
    }

    if (currentNode === targetId) {
      return paths.get(currentNode) ?? null;
    }

    const neighbors = adjacencyList.get(currentNode) ?? [];

    neighbors.forEach((neighbor) => {
      if (visited.has(neighbor.node)) {
        return;
      }

      visited.add(neighbor.node);
      const previous = paths.get(currentNode);

      if (!previous) {
        return;
      }

      const nextPath = {
        pathNodes: [...previous.pathNodes, neighbor.node],
        pathLinks: [...previous.pathLinks, neighbor.link],
      };

      paths.set(neighbor.node, nextPath);
      queue.push(nextPath.pathNodes);
    });
  }

  return null;
}
