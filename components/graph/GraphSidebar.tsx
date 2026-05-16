"use client";

import {
  Activity,
  Box,
  CheckSquare,
  Compass,
  Edit3,
  EyeOff,
  Layers,
  Link as LinkIcon,
  Monitor,
  Navigation,
  PieChart,
  Search,
  Settings,
  Trash2,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AIContentRenderer } from "@/components/ai/AIContentRenderer";
import { getGraphAnalytics } from "@/lib/graph/analytics";
import type { GraphLinkType, GraphNode } from "@/schemas/graph";
import { useGraphStore } from "@/hooks/use-graph-store";

type GraphSidebarProps = {
  colors: string[];
};

const linkTypes: { value: GraphLinkType; label: string }[] = [
  { value: "default", label: "Default (Thin Line)" },
  { value: "dependency", label: "Dependency (Red Dashed)" },
  { value: "part_of", label: "Part Of (Green Dashed)" },
  { value: "tooling", label: "Tooling (Purple Line)" },
  { value: "core", label: "Core (Thick Line)" },
  { value: "related", label: "Related" },
];

export function GraphSidebar({ colors }: GraphSidebarProps) {
  const store = useGraphStore();
  const [editNodeDesc, setEditNodeDesc] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const primarySelectedNode = useMemo(() => {
    if (store.selectedNodes.size !== 1) {
      return null;
    }

    const selectedId = Array.from(store.selectedNodes)[0];
    return store.graph.nodes.find((node) => node.id === selectedId) ?? null;
  }, [store.graph.nodes, store.selectedNodes]);

  const activeColor = primarySelectedNode ? colors[(primarySelectedNode.group || 1) % colors.length] : null;
  const allGroups = useMemo(
    () => Array.from(new Set(store.graph.nodes.map((node) => node.group))).sort((a, b) => a - b),
    [store.graph.nodes],
  );
  const analytics = useMemo(() => getGraphAnalytics(store.graph), [store.graph]);

  const tabs = [
    { id: "explorer", label: "Explore", icon: Compass },
    { id: "filters", label: "Filter", icon: Layers },
    { id: "analytics", label: "Insights", icon: PieChart },
    { id: "settings", label: "Prefs", icon: Settings },
  ] as const;

  function saveNodeEdit(node: GraphNode) {
    store.updateNodeDescription(node.id, editNodeDesc);
    setIsEditingDesc(false);
    setEditingNodeId(null);
  }

  return (
    <aside className="sidebar">
      <div>
        <h1>Knowledge Graph</h1>
      </div>

      <div className="tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`tab-btn ${store.activeTab === tab.id ? "active" : ""}`}
              onClick={() => store.setActiveTab(tab.id)}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {store.activeTab === "explorer" && (
        <>
          <div className="action-bar">
            <div className="search-container">
              <Search className="search-icon" size={16} />
              <input
                type="text"
                className="search-input"
                placeholder="Search entities..."
                value={store.searchQuery}
                onChange={(event) => store.setSearchQuery(event.target.value)}
              />
            </div>
            <div className="button-row">
              <button
                type="button"
                className={`action-btn ${!store.preferences.is3D ? "active" : ""}`}
                onClick={() => store.setPreference("is3D", false)}
              >
                <Monitor size={16} /> 2D
              </button>
              <button
                type="button"
                className={`action-btn ${store.preferences.is3D ? "active" : ""}`}
                onClick={() => store.setPreference("is3D", true)}
              >
                <Box size={16} /> 3D
              </button>
            </div>
          </div>

          {store.selectedNodes.size === 1 && primarySelectedNode ? (
            <div className="node-details">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ color: activeColor ?? undefined }}>{primarySelectedNode.id}</h2>
                {primarySelectedNode.fx !== undefined && <Compass size={16} color="#fbbf24" />}
              </div>

              {isEditingDesc && editingNodeId === primarySelectedNode.id ? (
                <>
                  <textarea
                    className="search-input"
                    style={{ minHeight: 120, resize: "vertical", fontFamily: "var(--font-mono)" }}
                    value={editNodeDesc}
                    onChange={(event) => setEditNodeDesc(event.target.value)}
                    placeholder="Use Markdown format..."
                  />
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <button type="button" className="action-btn primary" onClick={() => saveNodeEdit(primarySelectedNode)}>
                      <CheckSquare size={16} /> Save Wiki
                    </button>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={() => {
                        setIsEditingDesc(false);
                        setEditingNodeId(null);
                      }}
                    >
                      <EyeOff size={16} /> Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <AIContentRenderer
                    className="markdown-body"
                    content={primarySelectedNode.desc || "*No description provided. Click Edit Wiki to add one.*"}
                  />
                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <button
                      type="button"
                      className="action-btn primary"
                      onClick={() => {
                        setEditNodeDesc(primarySelectedNode.desc);
                        setEditingNodeId(primarySelectedNode.id);
                        setIsEditingDesc(true);
                      }}
                    >
                      <Edit3 size={16} /> Edit Wiki
                    </button>
                    {primarySelectedNode.fx !== undefined && (
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => store.unpinNode(primarySelectedNode.id)}
                        title="Unpin Node"
                      >
                        <Compass size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="action-btn"
                      onClick={store.deleteSelectedNodes}
                      style={{ flex: 0, borderColor: "#ef4444", color: "#f87171" }}
                      title="Delete Node"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                {store.pathData ? (
                  <button
                    type="button"
                    className="action-btn"
                    onClick={store.clearPath}
                    style={{ borderColor: "#ef4444", color: "#f87171" }}
                  >
                    <XCircle size={16} /> Clear Path
                  </button>
                ) : (
                  <button type="button" className="action-btn primary" onClick={() => store.setPathfindingMode(true)}>
                    <Navigation size={16} /> Find Shortest Path
                  </button>
                )}
                <button type="button" className="action-btn" onClick={() => store.setLinkingFrom(primarySelectedNode.id)}>
                  <LinkIcon size={16} /> Add Link
                </button>
              </div>
            </div>
          ) : store.selectedNodes.size > 1 ? (
            <div className="node-details">
              <h2>Bulk Actions</h2>
              <p style={{ color: "var(--text-secondary)" }}>{store.selectedNodes.size} nodes selected.</p>
              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, display: "block" }}>
                  Change Color Group
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {colors.map((color, index) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => store.updateSelectedNodesGroup(index)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: color,
                        cursor: "pointer",
                        border: "2px solid rgba(255,255,255,0.1)",
                      }}
                      title={`Group ${index}`}
                    />
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <button
                  type="button"
                  className="action-btn"
                  onClick={store.deleteSelectedNodes}
                  style={{ borderColor: "#ef4444", color: "#f87171" }}
                >
                  <Trash2 size={16} /> Delete Selected ({store.selectedNodes.size})
                </button>
                <button type="button" className="action-btn" onClick={() => store.setSelectedNodes(new Set())}>
                  <XCircle size={16} /> Clear Selection
                </button>
              </div>
            </div>
          ) : (
            <div className="node-details" style={{ opacity: 0.72 }}>
              <h2>Explorer Mode</h2>
              <p>
                Click a node to view its wiki.
                <br />
                Click a link to edit semantics.
                <br />
                Ctrl or Shift click to multi-select nodes.
              </p>
            </div>
          )}

          {store.selectedLink && store.selectedNodes.size === 0 && (
            <div className="node-details" style={{ marginTop: 16 }}>
              <h2>Edge Semantics</h2>
              <div className="settings-group">
                <label>Semantic Type</label>
                <select
                  value={store.selectedLink.type}
                  onChange={(event) => store.selectedLink && store.updateLink(store.selectedLink, "type", event.target.value)}
                  style={{ width: "100%", padding: 8, borderRadius: 6, background: "rgba(0,0,0,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {linkTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="settings-group">
                <label>Label</label>
                <input
                  type="text"
                  className="search-input"
                  value={store.selectedLink.name}
                  onChange={(event) => store.selectedLink && store.updateLink(store.selectedLink, "name", event.target.value)}
                  placeholder="e.g. built with, uses, funds..."
                />
              </div>
            </div>
          )}
        </>
      )}

      {store.activeTab === "filters" && (
        <div className="node-details">
          <h2>Category Filters</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 16 }}>
            Toggle visibility of specific data groups.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {allGroups.map((group) => (
              <label
                key={group}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 8, background: "rgba(255,255,255,0.05)", borderRadius: 6 }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: colors[group % colors.length] }} />
                  <span style={{ fontSize: 14 }}>Group {group}</span>
                </span>
                <input type="checkbox" checked={!store.hiddenGroups.has(group)} onChange={() => store.toggleGroup(group)} />
              </label>
            ))}
          </div>
        </div>
      )}

      {store.activeTab === "analytics" && analytics && (
        <div className="node-details" style={{ overflowY: "auto", maxHeight: "calc(100vh - 120px)" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={18} /> Graph Insights
          </h2>

          <InsightsList title="Structural Hubs (Degree)" rows={analytics.hubs.map((hub) => ({ label: hub.node.id, value: `${hub.degree} edges`, color: colors[(hub.node.group || 1) % colors.length] }))} />
          <InsightsList title="Bottlenecks (Bridging)" rows={analytics.bottlenecks.map((row) => ({ label: row.node.id, value: `${row.groupsConnected} groups`, color: colors[(row.node.group || 1) % colors.length] }))} />

          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>Group Composition</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(analytics.groups).map(([group, count]) => (
                <div key={group} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.2)", padding: "4px 8px", borderRadius: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: colors[Number(group) % colors.length] }} />
                  <span style={{ fontSize: 12 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {store.activeTab === "settings" && (
        <div className="node-details">
          <h2>Preferences</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 16 }}>Customize the visual physics engine.</p>
          <div className="settings-group">
            <label>Layout Engine (DAG)</label>
            <select
              value={store.preferences.dagMode}
              onChange={(event) => store.setPreference("dagMode", event.target.value as typeof store.preferences.dagMode)}
              style={{ width: "100%", padding: 8, borderRadius: 6, background: "rgba(0,0,0,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <option value="">Freeform Physics</option>
              <option value="td">Top-Down Hierarchical</option>
              <option value="bu">Bottom-Up Hierarchical</option>
              <option value="lr">Left-Right Flow</option>
              <option value="rl">Right-Left Flow</option>
              <option value="radialout">Radial Outward</option>
              <option value="radialin">Radial Inward</option>
            </select>
          </div>
          <div className="settings-group" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ margin: 0 }}>Show Node Labels</label>
            <input
              type="checkbox"
              checked={store.preferences.showLabels}
              onChange={(event) => store.setPreference("showLabels", event.target.checked)}
            />
          </div>
          <div className="settings-group">
            <label>
              <span>Node Repulsion</span>
              <span>{store.preferences.chargeStrength}</span>
            </label>
            <input
              type="range"
              min="-300"
              max="0"
              value={store.preferences.chargeStrength}
              className="slider"
              onChange={(event) => store.setPreference("chargeStrength", Number(event.target.value))}
            />
          </div>
          <div className="settings-group">
            <label>
              <span>Link Distance</span>
              <span>{store.preferences.linkDistance}</span>
            </label>
            <input
              type="range"
              min="10"
              max="200"
              value={store.preferences.linkDistance}
              className="slider"
              onChange={(event) => store.setPreference("linkDistance", Number(event.target.value))}
            />
          </div>
        </div>
      )}
    </aside>
  );
}

type InsightRow = {
  label: string;
  value: string;
  color: string;
};

function InsightsList({ title, rows }: { title: string; rows: InsightRow[] }) {
  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>{title}</h3>
      {rows.map((row) => (
        <div key={`${title}-${row.label}`} style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ color: row.color }}>{row.label}</span>
          <span style={{ color: "var(--text-secondary)" }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
