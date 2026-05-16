"use client";

import { useEffect, useMemo, useState } from "react";

import { getVisibleGraph } from "@/lib/graph/visibility";
import { useGraphStore } from "@/hooks/use-graph-store";

import { AgentPanel } from "../agents/AgentPanel";
import { GraphCanvas } from "./GraphCanvas";
import { GraphSidebar } from "./GraphSidebar";

const graphColors = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

export function GraphWorkspace() {
  const store = useGraphStore();
  const initialize = useGraphStore((state) => state.initialize);
  const undo = useGraphStore((state) => state.undo);
  const redo = useGraphStore((state) => state.redo);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    const timer = window.setTimeout(() => initialize(), 350);
    return () => window.clearTimeout(timer);
  }, [initialize]);

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const targetTag = target instanceof HTMLElement ? target.tagName : "";

      if (targetTag === "INPUT" || targetTag === "TEXTAREA" || targetTag === "SELECT") {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [redo, undo]);

  const visibleGraph = useMemo(
    () => getVisibleGraph(store.graph, store.hiddenGroups, store.collapsedNodes),
    [store.collapsedNodes, store.graph, store.hiddenGroups],
  );

  return (
    <main className="app-container">
      {store.loading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <p>Constructing Knowledge Graph...</p>
        </div>
      )}

      {store.linkingFrom && (
        <div style={{ position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", background: "var(--accent-color)", color: "#fff", padding: "12px 28px", borderRadius: 999, zIndex: 100, fontWeight: 600 }}>
          Linking mode: Click on another node to connect.
        </div>
      )}

      {store.pathfindingMode && (
        <div style={{ position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", background: "#10b981", color: "#fff", padding: "12px 28px", borderRadius: 999, zIndex: 100, fontWeight: 600 }}>
          Pathfinding: Select a target node to find the shortest path.
        </div>
      )}

      {!store.loading && (
        <>
          <GraphSidebar colors={graphColors} />
          <GraphCanvas visibleGraph={visibleGraph} dimensions={dimensions} colors={graphColors} />
          <AgentPanel />
        </>
      )}
    </main>
  );
}
