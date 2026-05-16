"use client";

import dynamic from "next/dynamic";
import { Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as React from "react";
import * as THREE from "three";
import type {
  ForceGraphMethods as ForceGraph2DMethods,
  ForceGraphProps as ForceGraph2DProps,
  LinkObject as LinkObject2D,
  NodeObject as NodeObject2D,
} from "react-force-graph-2d";
import type {
  ForceGraphMethods as ForceGraph3DMethods,
  ForceGraphProps as ForceGraph3DProps,
  LinkObject as LinkObject3D,
  NodeObject as NodeObject3D,
} from "react-force-graph-3d";

import { getLinkKey, getNodeId } from "@/lib/graph/link-utils";
import type { GraphLink, GraphNode, KnowledgeGraph, RuntimeGraphLink } from "@/schemas/graph";
import { normalizeRuntimeLink, useGraphStore } from "@/hooks/use-graph-store";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false }) as React.ComponentType<
  ForceGraph2DProps<GraphNode, GraphLink> & {
    ref?: React.MutableRefObject<ForceGraph2DMethods<GraphNode, GraphLink> | undefined>;
  }
>;

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false }) as React.ComponentType<
  ForceGraph3DProps<GraphNode, GraphLink> & {
    ref?: React.MutableRefObject<ForceGraph3DMethods<GraphNode, GraphLink> | undefined>;
  }
>;

type GraphCanvasProps = {
  visibleGraph: KnowledgeGraph;
  dimensions: { width: number; height: number };
  colors: string[];
};

type NodeVisualState = {
  color: string;
  isDimmed: boolean;
  isHighlight: boolean;
  isPath: boolean;
  isSearchMatch: boolean;
  isSelected: boolean;
  isLinking: boolean;
  showLabels: boolean;
};

function createNodeSprite(node: GraphNode, nodeState: NodeVisualState) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.Object3D();
  }

  const cx = 64;
  const cy = 48;
  const size = (node.val || 20) * 0.8;
  const { color, isDimmed, isHighlight, isPath, isSearchMatch, isSelected, isLinking, showLabels } = nodeState;

  ctx.shadowBlur = isHighlight || isSearchMatch || isSelected || isLinking ? 20 : 0;
  ctx.shadowColor = isSearchMatch ? "#fbbf24" : isPath ? "#2dd4bf" : isSelected || isLinking ? "#ffffff" : color;
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, 2 * Math.PI, false);

  if (isDimmed) {
    ctx.fillStyle = `${color}22`;
  } else {
    const gradient = ctx.createRadialGradient(cx - size * 0.3, cy - size * 0.3, size * 0.1, cx, cy, size);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.3, isPath ? "#2dd4bf" : color);
    gradient.addColorStop(1, isPath ? "#0d9488" : `${color}88`);
    ctx.fillStyle = gradient;
  }

  ctx.fill();
  ctx.shadowBlur = 0;

  if (isSelected || isHighlight || isSearchMatch || isLinking || isPath) {
    ctx.beginPath();
    ctx.arc(cx, cy, size + 2, 0, 2 * Math.PI, false);
    ctx.lineWidth = 2;
    ctx.strokeStyle = isSearchMatch ? "#fbbf24" : isPath ? "#2dd4bf" : "#ffffff";
    ctx.stroke();
  }

  if (showLabels || isSelected || isHighlight || isPath || isSearchMatch) {
    const fontSize = isHighlight || isSearchMatch || isLinking || isPath ? 16 : 12;
    ctx.font = `${isHighlight || isSearchMatch ? "600" : "400"} ${fontSize}px Geist, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 4;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.fillStyle = isDimmed ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.95)";
    ctx.fillText(node.id, cx, cy + size + fontSize + 4);
    ctx.shadowBlur = 0;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(40, 40, 1);
  return sprite;
}

export function GraphCanvas({ visibleGraph, dimensions, colors }: GraphCanvasProps) {
  const store = useGraphStore();
  const fg2dRef = useRef<ForceGraph2DMethods<GraphNode, GraphLink> | undefined>(undefined);
  const fg3dRef = useRef<ForceGraph3DMethods<GraphNode, GraphLink> | undefined>(undefined);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const runtimeGraph = useMemo(
    () => ({
      nodes: visibleGraph.nodes.map((node) => ({ ...node })),
      links: visibleGraph.links.map((link) => ({ ...link })),
    }),
    [visibleGraph],
  );

  const searchMatches = useMemo(() => {
    const matches = new Set<string>();
    const query = store.searchQuery.trim().toLowerCase();

    if (!query) {
      return matches;
    }

    visibleGraph.nodes.forEach((node) => {
      if (node.id.toLowerCase().includes(query) || node.desc.toLowerCase().includes(query)) {
        matches.add(node.id);
      }
    });

    return matches;
  }, [store.searchQuery, visibleGraph.nodes]);

  const highlighted = useMemo(() => {
    const nodes = new Set<string>();
    const links = new Set<string>();

    if (store.pathData) {
      store.pathData.nodes.forEach((node) => nodes.add(node));
      store.pathData.links.forEach((link) => links.add(link));
      return { nodes, links };
    }

    if (store.hoverNode) {
      nodes.add(store.hoverNode.id);
    }

    if (store.linkingFrom) {
      nodes.add(store.linkingFrom);
    }

    store.selectedNodes.forEach((node) => nodes.add(node));

    if (store.hoverNode || store.selectedNodes.size > 0 || store.linkingFrom) {
      visibleGraph.links.forEach((link) => {
        const isHoverConnected = store.hoverNode && (link.source === store.hoverNode.id || link.target === store.hoverNode.id);
        const isSelectedConnected = store.selectedNodes.has(link.source) || store.selectedNodes.has(link.target);
        const isLinkingConnected = store.linkingFrom === link.source || store.linkingFrom === link.target;

        if (isHoverConnected || isSelectedConnected || isLinkingConnected) {
          links.add(getLinkKey(link));
          nodes.add(link.source);
          nodes.add(link.target);
        }
      });
    }

    return { nodes, links };
  }, [store.hoverNode, store.linkingFrom, store.pathData, store.selectedNodes, visibleGraph.links]);

  useEffect(() => {
    if (store.preferences.is3D || !fg2dRef.current || store.loading) {
      return;
    }

    const forceGraph = fg2dRef.current;
    const chargeForce = forceGraph.d3Force("charge");
    const linkForce = forceGraph.d3Force("link");

    if (chargeForce) {
      chargeForce.strength?.(store.preferences.chargeStrength);
    }

    if (linkForce) {
      linkForce.distance?.(store.preferences.linkDistance);
    }

    forceGraph.d3ReheatSimulation();
  }, [store.loading, store.preferences.chargeStrength, store.preferences.dagMode, store.preferences.is3D, store.preferences.linkDistance]);

  useEffect(() => {
    if (store.preferences.is3D || !minimapCanvasRef.current || !runtimeGraph.nodes.length) {
      return;
    }

    let animationFrameId = 0;

    const renderMinimap = () => {
      const canvas = minimapCanvasRef.current;
      const ctx = canvas?.getContext("2d");

      if (!canvas || !ctx) {
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      runtimeGraph.nodes.forEach((node) => {
        if (typeof node.x !== "number" || typeof node.y !== "number") {
          return;
        }

        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
      });

      if (minX === Infinity) {
        animationFrameId = requestAnimationFrame(renderMinimap);
        return;
      }

      const padding = 10;
      const graphWidth = Math.max(maxX - minX, 1);
      const graphHeight = Math.max(maxY - minY, 1);
      const scale = Math.min((canvas.width - padding * 2) / graphWidth, (canvas.height - padding * 2) / graphHeight);
      const offsetX = (canvas.width - graphWidth * scale) / 2 - minX * scale;
      const offsetY = (canvas.height - graphHeight * scale) / 2 - minY * scale;

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.1)";

      runtimeGraph.links.forEach((link) => {
        const sourceId = getNodeId(link.source);
        const targetId = getNodeId(link.target);
        const source = runtimeGraph.nodes.find((node) => node.id === sourceId);
        const target = runtimeGraph.nodes.find((node) => node.id === targetId);

        if (!source || !target || typeof source.x !== "number" || typeof source.y !== "number" || typeof target.x !== "number" || typeof target.y !== "number") {
          return;
        }

        ctx.beginPath();
        ctx.moveTo(source.x * scale + offsetX, source.y * scale + offsetY);
        ctx.lineTo(target.x * scale + offsetX, target.y * scale + offsetY);
        ctx.stroke();
      });

      runtimeGraph.nodes.forEach((node) => {
        if (typeof node.x !== "number" || typeof node.y !== "number") {
          return;
        }

        ctx.fillStyle = colors[(node.group || 1) % colors.length] ?? "#3b82f6";
        ctx.beginPath();
        ctx.arc(node.x * scale + offsetX, node.y * scale + offsetY, Math.max(node.val * scale * 0.5, 2), 0, 2 * Math.PI);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(renderMinimap);
    };

    renderMinimap();
    return () => cancelAnimationFrame(animationFrameId);
  }, [colors, runtimeGraph.links, runtimeGraph.nodes, store.preferences.is3D]);

  const handleNodeClick = useCallback(
    (node: GraphNode, event: MouseEvent) => {
      if (store.linkingFrom) {
        if (store.linkingFrom !== node.id) {
          store.addLink(store.linkingFrom, node.id);
        }
        store.setLinkingFrom(null);
        return;
      }

      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        const next = new Set(store.selectedNodes);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }
        store.setSelectedNodes(next);
        store.clearPath();
        return;
      }

      if (store.pathfindingMode) {
        if (store.selectedNodes.size !== 1) {
          store.setSelectedNodes(new Set([node.id]));
          return;
        }

        const selectedId = Array.from(store.selectedNodes)[0];
        if (selectedId && selectedId !== node.id) {
          const found = store.calculateShortestPath(selectedId, node.id);
          store.setPathfindingMode(false);

          if (!found) {
            window.alert("No path found between these nodes.");
          }
        }
        return;
      }

      store.setSelectedNodes(new Set([node.id]));
      store.setSelectedLink(null);
      store.clearPath();

      if (!store.preferences.is3D && fg2dRef.current && typeof node.x === "number" && typeof node.y === "number") {
        fg2dRef.current.centerAt(node.x, node.y, 1000);
        fg2dRef.current.zoom(2, 2000);
      } else if (store.preferences.is3D && fg3dRef.current && typeof node.x === "number" && typeof node.y === "number") {
        const z = node.z ?? 0;
        const distRatio = 1 + 100 / Math.hypot(node.x, node.y, z);
        fg3dRef.current.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: z * distRatio },
          { x: node.x, y: node.y, z },
          2000,
        );
      }
    },
    [store],
  );

  const paintNode = useCallback(
    (node: NodeObject2D<GraphNode>, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (!node.id || typeof node.id !== "string" || typeof node.x !== "number" || typeof node.y !== "number") {
        return;
      }

      const isSearchMatch = store.searchQuery.length > 0 && searchMatches.has(node.id);
      const isHighlighted = highlighted.nodes.has(node.id);
      const isSelected = store.selectedNodes.has(node.id);
      const isHovered = store.hoverNode?.id === node.id;
      const isPath = Boolean(store.pathData?.nodes.has(node.id));
      const interactionActive = Boolean(store.hoverNode || store.selectedNodes.size > 0 || store.linkingFrom || store.pathData);
      const isInteractionDimmed = interactionActive && !isHighlighted;
      const isSearchDimmed = store.searchQuery.length > 0 && !isSearchMatch;
      const isDimmed = isInteractionDimmed || (isSearchDimmed && !isHighlighted);
      const size = (node.val || 20) * 0.4;
      const color = colors[(node.group || 1) % colors.length] ?? "#3b82f6";

      ctx.shadowBlur = isHighlighted || isSearchMatch || isSelected || store.linkingFrom === node.id ? 25 : 0;
      ctx.shadowColor = isSearchMatch ? "#fbbf24" : isPath ? "#2dd4bf" : isSelected || store.linkingFrom === node.id ? "#ffffff" : color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);

      if (isDimmed) {
        ctx.fillStyle = `${color}22`;
      } else {
        const gradient = ctx.createRadialGradient(node.x - size * 0.3, node.y - size * 0.3, size * 0.1, node.x, node.y, size);
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(0.3, isPath ? "#2dd4bf" : color);
        gradient.addColorStop(1, isPath ? "#0d9488" : `${color}88`);
        ctx.fillStyle = gradient;
      }

      ctx.fill();
      ctx.shadowBlur = 0;

      if (isSelected || isHovered || isSearchMatch || store.linkingFrom === node.id || isPath) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI, false);
        ctx.lineWidth = 2 / globalScale;
        ctx.strokeStyle = isSearchMatch ? "#fbbf24" : isPath ? "#2dd4bf" : "#ffffff";
        ctx.stroke();
      }

      if (store.preferences.showLabels || isHovered || isSelected || isHighlighted) {
        const fontSize = isHighlighted || isSearchMatch || store.linkingFrom === node.id || isPath ? 15 / globalScale : 12 / globalScale;
        ctx.font = `${isHighlighted || isSearchMatch ? "600" : "400"} ${fontSize}px Geist, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowBlur = 4;
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.fillStyle = isDimmed ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.95)";
        ctx.fillText(node.id, node.x, node.y + size + fontSize + 4);
        ctx.shadowBlur = 0;
      }
    },
    [colors, highlighted.nodes, searchMatches, store],
  );

  const paintLink = useCallback(
    (rawLink: LinkObject2D<GraphNode, GraphLink>, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const link = normalizeRuntimeLink(rawLink as RuntimeGraphLink);
      const start = typeof rawLink.source === "object" ? rawLink.source : runtimeGraph.nodes.find((node) => node.id === rawLink.source);
      const end = typeof rawLink.target === "object" ? rawLink.target : runtimeGraph.nodes.find((node) => node.id === rawLink.target);

      if (!start || !end || typeof start.x !== "number" || typeof start.y !== "number" || typeof end.x !== "number" || typeof end.y !== "number") {
        return;
      }

      const linkKey = getLinkKey(link);
      const isHighlighted = highlighted.links.has(linkKey);
      const isSearchDimmed = store.searchQuery.length > 0 && !searchMatches.has(start.id) && !searchMatches.has(end.id);
      const interactionActive = Boolean(store.hoverNode || store.selectedNodes.size > 0 || store.linkingFrom || store.pathData);
      const isInteractionDimmed = interactionActive && !isHighlighted;
      const isDimmed = isInteractionDimmed || (isSearchDimmed && !isHighlighted);
      const isPath = Boolean(store.pathData?.links.has(linkKey));
      const weight = link.weight || 2;
      const curvature = link.curvature || 0;
      const type = link.type || "default";
      let startColor = colors[(start.group || 1) % colors.length] ?? "#3b82f6";
      let endColor = colors[(end.group || 1) % colors.length] ?? "#3b82f6";

      if (type === "dependency") {
        startColor = "#ef4444";
        endColor = "#ef4444";
      } else if (type === "part_of") {
        startColor = "#10b981";
        endColor = "#10b981";
      } else if (type === "tooling") {
        startColor = "#8b5cf6";
        endColor = "#8b5cf6";
      }

      if (isPath) {
        startColor = "#2dd4bf";
        endColor = "#2dd4bf";
      }

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);

      let ctrlX = (start.x + end.x) / 2;
      let ctrlY = (start.y + end.y) / 2;

      if (curvature !== 0) {
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        const normalX = -(end.y - start.y) / length;
        const normalY = (end.x - start.x) / length;
        ctrlX += normalX * length * curvature;
        ctrlY += normalY * length * curvature;
        ctx.quadraticCurveTo(ctrlX, ctrlY, end.x, end.y);
      } else {
        ctx.lineTo(end.x, end.y);
      }

      ctx.lineWidth = (isHighlighted ? weight * 1.5 : weight * 0.6) / globalScale;

      if (type === "dependency") {
        ctx.setLineDash([4 / globalScale, 4 / globalScale]);
      } else if (type === "part_of") {
        ctx.setLineDash([12 / globalScale, 6 / globalScale]);
      } else {
        ctx.setLineDash([]);
      }

      if (!isDimmed) {
        const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
        gradient.addColorStop(0, isHighlighted ? startColor : `${startColor}88`);
        gradient.addColorStop(1, isHighlighted ? endColor : `${endColor}88`);
        ctx.strokeStyle = gradient;

        if (isHighlighted || isPath) {
          ctx.shadowBlur = isPath ? 15 : 8;
          ctx.shadowColor = startColor;
        }
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      }

      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      if (!isDimmed && link.name) {
        const midX = curvature !== 0 ? 0.25 * start.x + 0.5 * ctrlX + 0.25 * end.x : (start.x + end.x) / 2;
        const midY = curvature !== 0 ? 0.25 * start.y + 0.5 * ctrlY + 0.25 * end.y : (start.y + end.y) / 2;
        ctx.font = `400 ${10 / globalScale}px Geist, sans-serif`;
        ctx.fillStyle = isHighlighted ? "#ffffff" : "rgba(255,255,255,0.7)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(link.name, midX, midY - 6 / globalScale);
      }
    },
    [colors, highlighted.links, runtimeGraph.nodes, searchMatches, store],
  );

  function linkColor(rawLink: LinkObject3D<GraphNode, GraphLink>) {
    const link = normalizeRuntimeLink(rawLink as RuntimeGraphLink);
    const linkKey = getLinkKey(link);

    if (store.pathData?.links.has(linkKey)) {
      return "#2dd4bf";
    }

    if (highlighted.links.has(linkKey)) {
      return "#ffffff";
    }

    if (link.type === "dependency") {
      return "rgba(239, 68, 68, 0.8)";
    }

    if (link.type === "part_of") {
      return "rgba(16, 185, 129, 0.8)";
    }

    if (link.type === "tooling") {
      return "rgba(139, 92, 246, 0.8)";
    }

    return "rgba(255,255,255,0.2)";
  }

  return (
    <div
      className="graph-container"
      onMouseMove={(event) => {
        setMousePosition({ x: event.clientX, y: event.clientY });

        if (tooltipRef.current) {
          tooltipRef.current.style.left = `${event.clientX + 15}px`;
          tooltipRef.current.style.top = `${event.clientY + 15}px`;
        }
      }}
    >
      {store.preferences.is3D ? (
        <ForceGraph3D
          ref={fg3dRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={runtimeGraph}
          backgroundColor="#050505"
          nodeRelSize={4}
          controlType="orbit"
          nodeLabel="id"
          dagMode={store.preferences.dagMode || undefined}
          dagLevelDistance={store.preferences.dagMode ? store.preferences.linkDistance : null}
          nodeThreeObject={(node: NodeObject3D<GraphNode>) => {
            const nodeId = typeof node.id === "string" ? node.id : "";
            const interactionActive = Boolean(store.hoverNode || store.selectedNodes.size > 0 || store.linkingFrom || store.pathData);
            const isHighlight = highlighted.nodes.has(nodeId);
            const isInteractionDimmed = interactionActive && !isHighlight;
            const isSearchMatch = store.searchQuery.length > 0 && searchMatches.has(nodeId);
            const isSearchDimmed = store.searchQuery.length > 0 && !isSearchMatch;

            return createNodeSprite(node as GraphNode, {
              color: colors[(node.group || 1) % colors.length] ?? "#3b82f6",
              isDimmed: isInteractionDimmed || (isSearchDimmed && !isHighlight),
              isHighlight,
              isPath: Boolean(store.pathData?.nodes.has(nodeId)),
              isSearchMatch,
              isSelected: store.selectedNodes.has(nodeId),
              isLinking: store.linkingFrom === nodeId,
              showLabels: store.preferences.showLabels,
            });
          }}
          nodeThreeObjectExtend={false}
          linkCurvature="curvature"
          linkDirectionalArrowLength={(link) => (highlighted.links.has(getLinkKey(normalizeRuntimeLink(link as RuntimeGraphLink))) || store.pathData?.links.has(getLinkKey(normalizeRuntimeLink(link as RuntimeGraphLink))) ? 5 : 3.5)}
          linkDirectionalArrowRelPos={1}
          linkDirectionalParticles={(link) => (highlighted.links.has(getLinkKey(normalizeRuntimeLink(link as RuntimeGraphLink))) || store.pathData?.links.has(getLinkKey(normalizeRuntimeLink(link as RuntimeGraphLink))) ? 4 : 0)}
          linkDirectionalParticleWidth={2}
          linkWidth={(link) => (highlighted.links.has(getLinkKey(normalizeRuntimeLink(link as RuntimeGraphLink))) || store.pathData?.links.has(getLinkKey(normalizeRuntimeLink(link as RuntimeGraphLink))) ? 2 : (link.weight ?? 2) * 0.4)}
          linkColor={linkColor}
          onNodeHover={(node) => store.setHoverNode(node && typeof node.id === "string" ? (node as GraphNode) : null)}
          onNodeClick={(node, event) => node.id && handleNodeClick(node as GraphNode, event)}
          onNodeRightClick={(node) => node.id && store.toggleCollapsedNode(String(node.id))}
          onNodeDragEnd={(node) => store.pinNode(node as GraphNode)}
          onBackgroundClick={store.resetInteraction}
          onBackgroundRightClick={store.addNode}
          onLinkClick={(link) => {
            store.setSelectedLink(normalizeRuntimeLink(link as RuntimeGraphLink));
            store.setSelectedNodes(new Set());
          }}
        />
      ) : (
        <ForceGraph2D
          ref={fg2dRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={runtimeGraph}
          nodeLabel="id"
          nodeRelSize={8}
          dagMode={store.preferences.dagMode || undefined}
          dagLevelDistance={store.preferences.dagMode ? store.preferences.linkDistance : null}
          nodeCanvasObject={paintNode}
          nodeCanvasObjectMode={() => "replace"}
          linkWidth={(link) => (highlighted.links.has(getLinkKey(normalizeRuntimeLink(link as RuntimeGraphLink))) || store.pathData?.links.has(getLinkKey(normalizeRuntimeLink(link as RuntimeGraphLink))) ? 2 : (link.weight ?? 2) * 0.4)}
          linkColor={(link) => {
            const normalized = normalizeRuntimeLink(link as RuntimeGraphLink);
            if (store.pathData?.links.has(getLinkKey(normalized))) {
              return "#2dd4bf";
            }
            if (highlighted.links.has(getLinkKey(normalized))) {
              return "#ffffff";
            }
            return "rgba(255,255,255,0.2)";
          }}
          linkDirectionalArrowLength={(link) => (highlighted.links.has(getLinkKey(normalizeRuntimeLink(link as RuntimeGraphLink))) || store.pathData?.links.has(getLinkKey(normalizeRuntimeLink(link as RuntimeGraphLink))) ? 5 : 3.5)}
          linkDirectionalArrowRelPos={1}
          linkCurvature="curvature"
          linkCanvasObject={paintLink}
          onNodeHover={(node) => store.setHoverNode(node && typeof node.id === "string" ? (node as GraphNode) : null)}
          onNodeClick={(node, event) => node.id && handleNodeClick(node as GraphNode, event)}
          onNodeRightClick={(node) => node.id && store.toggleCollapsedNode(String(node.id))}
          onNodeDragEnd={(node) => store.pinNode(node as GraphNode)}
          onBackgroundClick={store.resetInteraction}
          onBackgroundRightClick={store.addNode}
          onLinkClick={(link) => {
            store.setSelectedLink(normalizeRuntimeLink(link as RuntimeGraphLink));
            store.setSelectedNodes(new Set());
          }}
          cooldownTicks={100}
        />
      )}

      {store.hoverNode && store.selectedNodes.size === 0 && (
        <div
          ref={tooltipRef}
          style={{
            position: "absolute",
            left: mousePosition.x + 15,
            top: mousePosition.y + 15,
            background: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(12px)",
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            pointerEvents: "none",
            zIndex: 1000,
            color: "white",
            boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
            maxWidth: 220,
          }}
        >
          <h4 style={{ margin: "0 0 6px", fontSize: 15, color: colors[(store.hoverNode.group || 1) % colors.length] }}>
            {store.hoverNode.id}
          </h4>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>
            {store.hoverNode.desc || "No description provided. Click to view or edit."}
          </p>
        </div>
      )}

      {!store.preferences.is3D && (
        <>
          <div className="mini-map-container">
            <canvas
              ref={minimapCanvasRef}
              width={200}
              height={150}
              onClick={() => fg2dRef.current?.zoomToFit(400, 50)}
              title="Click to zoom to fit"
            />
          </div>
          <div className="controls" style={{ right: 240 }}>
            <button type="button" className="btn" onClick={() => fg2dRef.current?.zoomToFit(400, 50)} title="Zoom to fit">
              <Maximize size={18} />
            </button>
            <button type="button" className="btn" onClick={() => fg2dRef.current?.zoom(fg2dRef.current.zoom() * 1.5, 400)} title="Zoom in">
              <ZoomIn size={18} />
            </button>
            <button type="button" className="btn" onClick={() => fg2dRef.current?.zoom(fg2dRef.current.zoom() / 1.5, 400)} title="Zoom out">
              <ZoomOut size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
