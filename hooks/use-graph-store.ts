"use client";

import { create } from "zustand";

import { getLinkKey, normalizeLink, processLinks } from "@/lib/graph/link-utils";
import { findShortestPath } from "@/lib/graph/pathfinding";
import { generateSampleGraph } from "@/lib/graph/sample-data";
import type { GraphLink, GraphLinkType, GraphNode, GraphViewPreferences, KnowledgeGraph, RuntimeGraphLink } from "@/schemas/graph";

type ActiveTab = "explorer" | "filters" | "analytics" | "settings";

type PathData = {
  nodes: Set<string>;
  links: Set<string>;
};

type GraphStore = {
  graph: KnowledgeGraph;
  past: KnowledgeGraph[];
  future: KnowledgeGraph[];
  loading: boolean;
  activeTab: ActiveTab;
  selectedNodes: Set<string>;
  selectedLink: GraphLink | null;
  hoverNode: GraphNode | null;
  hiddenGroups: Set<number>;
  collapsedNodes: Set<string>;
  linkingFrom: string | null;
  pathfindingMode: boolean;
  pathData: PathData | null;
  searchQuery: string;
  preferences: GraphViewPreferences;
  setLoading: (loading: boolean) => void;
  initialize: () => void;
  updateGraph: (updater: KnowledgeGraph | ((graph: KnowledgeGraph) => KnowledgeGraph)) => void;
  undo: () => void;
  redo: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  setSearchQuery: (query: string) => void;
  setHoverNode: (node: GraphNode | null) => void;
  setSelectedNodes: (nodes: Set<string>) => void;
  setSelectedLink: (link: GraphLink | null) => void;
  toggleGroup: (group: number) => void;
  toggleCollapsedNode: (nodeId: string) => void;
  setLinkingFrom: (nodeId: string | null) => void;
  setPathfindingMode: (enabled: boolean) => void;
  clearPath: () => void;
  setPreference: <Key extends keyof GraphViewPreferences>(key: Key, value: GraphViewPreferences[Key]) => void;
  addNode: () => void;
  deleteSelectedNodes: () => void;
  updateNodeDescription: (nodeId: string, description: string) => void;
  updateSelectedNodesGroup: (group: number) => void;
  pinNode: (node: GraphNode) => void;
  unpinNode: (nodeId: string) => void;
  addLink: (source: string, target: string) => void;
  updateLink: (link: GraphLink, property: "name" | "type", value: string) => void;
  calculateShortestPath: (startId: string, targetId: string) => boolean;
  resetInteraction: () => void;
};

const defaultPreferences: GraphViewPreferences = {
  is3D: false,
  chargeStrength: -80,
  linkDistance: 60,
  dagMode: "",
  showLabels: true,
};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function withHistory(state: GraphStore, graph: KnowledgeGraph) {
  return {
    graph,
    past: [...state.past, state.graph].slice(-30),
    future: [],
  };
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  graph: { nodes: [], links: [] },
  past: [],
  future: [],
  loading: true,
  activeTab: "explorer",
  selectedNodes: new Set(),
  selectedLink: null,
  hoverNode: null,
  hiddenGroups: new Set(),
  collapsedNodes: new Set(),
  linkingFrom: null,
  pathfindingMode: false,
  pathData: null,
  searchQuery: "",
  preferences: defaultPreferences,
  setLoading: (loading) => set({ loading }),
  initialize: () => set({ graph: generateSampleGraph(), loading: false }),
  updateGraph: (updater) =>
    set((state) => {
      const nextGraph = typeof updater === "function" ? updater(state.graph) : updater;
      return nextGraph === state.graph ? {} : withHistory(state, nextGraph);
    }),
  undo: () =>
    set((state) => {
      if (state.past.length === 0) {
        return {};
      }

      const previous = state.past[state.past.length - 1];
      if (!previous) {
        return {};
      }

      return {
        graph: previous,
        past: state.past.slice(0, -1),
        future: [state.graph, ...state.future],
      };
    }),
  redo: () =>
    set((state) => {
      const next = state.future[0];

      if (!next) {
        return {};
      }

      return {
        graph: next,
        future: state.future.slice(1),
        past: [...state.past, state.graph],
      };
    }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setHoverNode: (hoverNode) => set({ hoverNode }),
  setSelectedNodes: (selectedNodes) => set({ selectedNodes }),
  setSelectedLink: (selectedLink) => set({ selectedLink }),
  toggleGroup: (group) =>
    set((state) => {
      const hiddenGroups = new Set(state.hiddenGroups);
      if (hiddenGroups.has(group)) {
        hiddenGroups.delete(group);
      } else {
        hiddenGroups.add(group);
      }
      return { hiddenGroups };
    }),
  toggleCollapsedNode: (nodeId) =>
    set((state) => {
      const collapsedNodes = new Set(state.collapsedNodes);
      if (collapsedNodes.has(nodeId)) {
        collapsedNodes.delete(nodeId);
      } else {
        collapsedNodes.add(nodeId);
      }
      return { collapsedNodes };
    }),
  setLinkingFrom: (linkingFrom) => set({ linkingFrom }),
  setPathfindingMode: (pathfindingMode) => set({ pathfindingMode }),
  clearPath: () => set({ pathData: null }),
  setPreference: (key, value) =>
    set((state) => ({
      preferences: {
        ...state.preferences,
        [key]: value,
      },
    })),
  addNode: () => {
    const newNode: GraphNode = {
      id: `New Node ${generateId()}`,
      group: Math.floor(Math.random() * 10) + 1,
      val: 20,
      desc: "A newly created node",
    };

    get().updateGraph((graph) => ({
      nodes: [...graph.nodes, newNode],
      links: processLinks(graph.links),
    }));
  },
  deleteSelectedNodes: () => {
    const selectedNodes = get().selectedNodes;

    if (selectedNodes.size === 0) {
      return;
    }

    get().updateGraph((graph) => ({
      nodes: graph.nodes.filter((node) => !selectedNodes.has(node.id)),
      links: graph.links.filter((link) => !selectedNodes.has(link.source) && !selectedNodes.has(link.target)),
    }));

    set({ selectedNodes: new Set(), selectedLink: null });
  },
  updateNodeDescription: (nodeId, description) => {
    get().updateGraph((graph) => ({
      ...graph,
      nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, desc: description } : node)),
    }));
  },
  updateSelectedNodesGroup: (group) => {
    const selectedNodes = get().selectedNodes;

    get().updateGraph((graph) => ({
      ...graph,
      nodes: graph.nodes.map((node) => (selectedNodes.has(node.id) ? { ...node, group } : node)),
    }));
  },
  pinNode: (node) => {
    get().updateGraph((graph) => ({
      ...graph,
      nodes: graph.nodes.map((current) =>
        current.id === node.id ? { ...current, fx: node.x, fy: node.y, fz: node.z } : current,
      ),
    }));
  },
  unpinNode: (nodeId) => {
    get().updateGraph((graph) => ({
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === nodeId ? { ...node, fx: undefined, fy: undefined, fz: undefined } : node,
      ),
    }));
  },
  addLink: (source, target) => {
    get().updateGraph((graph) => ({
      nodes: [...graph.nodes],
      links: processLinks([
        ...graph.links,
        {
          source,
          target,
          name: "related",
          type: "related",
          weight: 2,
        },
      ]),
    }));
  },
  updateLink: (selectedLink, property, value) => {
    const typedValue = property === "type" ? (value as GraphLinkType) : value;

    get().updateGraph((graph) => {
      const updatedLinks = graph.links.map((link) =>
        getLinkKey(link) === getLinkKey(selectedLink) ? { ...link, [property]: typedValue } : link,
      );

      return { ...graph, links: processLinks(updatedLinks) };
    });

    set((state) => ({
      selectedLink: state.selectedLink ? { ...state.selectedLink, [property]: typedValue } : null,
    }));
  },
  calculateShortestPath: (startId, targetId) => {
    const path = findShortestPath(startId, targetId, get().graph.links);

    if (!path) {
      set({ pathData: null });
      return false;
    }

    set({
      pathData: {
        nodes: new Set(path.pathNodes),
        links: new Set(path.pathLinks.map(getLinkKey)),
      },
    });

    return true;
  },
  resetInteraction: () =>
    set({
      selectedNodes: new Set(),
      selectedLink: null,
      linkingFrom: null,
      pathfindingMode: false,
      pathData: null,
    }),
}));

export function normalizeRuntimeLink(link: RuntimeGraphLink) {
  return normalizeLink(link);
}
