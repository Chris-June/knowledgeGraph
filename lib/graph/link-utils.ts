import type { GraphLink, GraphNode, RuntimeGraphLink } from "@/schemas/graph";

export function getNodeId(value: string | Pick<GraphNode, "id"> | undefined) {
  return typeof value === "string" ? value : value?.id ?? "";
}

export function normalizeLink(link: RuntimeGraphLink): GraphLink {
  return {
    ...link,
    source: getNodeId(link.source),
    target: getNodeId(link.target),
    curvature: link.curvature ?? 0,
  };
}

export function getLinkKey(link: Pick<GraphLink, "source" | "target" | "name" | "type">) {
  return `${link.source}->${link.target}:${link.name}:${link.type}`;
}

export function processLinks(links: RuntimeGraphLink[]): GraphLink[] {
  const normalized = links.map(normalizeLink);
  const pairCounts = new Map<string, number>();

  normalized.forEach((link) => {
    const pairId = link.source < link.target ? `${link.source}-${link.target}` : `${link.target}-${link.source}`;
    pairCounts.set(pairId, (pairCounts.get(pairId) ?? 0) + 1);
  });

  const pairIndex = new Map<string, number>();

  return normalized.map((link) => {
    const pairId = link.source < link.target ? `${link.source}-${link.target}` : `${link.target}-${link.source}`;
    const count = pairCounts.get(pairId) ?? 0;

    if (count <= 1) {
      return { ...link, pairId, curvature: 0 };
    }

    const index = (pairIndex.get(pairId) ?? 0) + 1;
    pairIndex.set(pairId, index);

    return {
      ...link,
      pairId,
      curvature: (index % 2 === 0 ? 1 : -1) * (Math.floor(index / 2) * 0.15 + 0.15),
    };
  });
}
