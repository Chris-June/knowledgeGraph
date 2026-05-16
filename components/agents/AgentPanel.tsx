"use client";

import { Bot, BrainCircuit, Database, FileText, Network, Route, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";

import { AIContentRenderer } from "@/components/ai/AIContentRenderer";
import type { AgentQueryResponse } from "@/schemas/graph-rag";

type AgentPanelState = {
  query: string;
  loading: boolean;
  response: AgentQueryResponse | null;
  error: string | null;
};

export function AgentPanel() {
  const [state, setState] = useState<AgentPanelState>({
    query: "What connects React and Node.js?",
    loading: false,
    response: null,
    error: null,
  });

  async function submitQuery() {
    if (!state.query.trim()) {
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await fetch("/api/agents/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: state.query,
          ownerId: "local-user",
          organizationId: "local-org",
          sessionId: "local-session",
          useModel: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Agent query failed with ${response.status}`);
      }

      const data = (await response.json()) as AgentQueryResponse;
      setState((current) => ({ ...current, loading: false, response: data }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown agent error",
      }));
    }
  }

  const confidence = state.response ? Math.round(state.response.retrieval.confidence * 100) : 0;

  return (
    <aside className="agent-panel" aria-label="Graph-RAG agent panel">
      <div className="agent-panel__header">
        <div className="agent-panel__title-block">
          <span className="agent-panel__eyebrow">
            <Bot size={14} /> Agentic retrieval
          </span>
          <h2>Graph-RAG Console</h2>
          <p>Ask against chunk nodes, graph paths, and citation-ready context.</p>
        </div>
        <div className="agent-panel__status" title="Server-side orchestration with scoped tools">
          <ShieldCheck size={15} />
          Governed
        </div>
      </div>

      <div className="agent-panel__input">
        <textarea
          value={state.query}
          onChange={(event) => setState((current) => ({ ...current, query: event.target.value }))}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              void submitQuery();
            }
          }}
          placeholder="Ask the graph..."
        />
        <div className="agent-panel__actions">
          <span>
            <Sparkles size={13} /> local graph strategy
          </span>
          <button type="button" onClick={() => void submitQuery()} disabled={state.loading}>
            <Send size={15} />
            {state.loading ? "Retrieving" : "Ask graph"}
          </button>
        </div>
      </div>

      {state.error && <div className="agent-panel__error">{state.error}</div>}

      {state.response ? (
        <div className="agent-panel__result">
          <div className="agent-panel__answer">
            <div className="agent-panel__answer-label">
              <BrainCircuit size={15} />
              Answer
            </div>
            <AIContentRenderer content={state.response.answer} className="markdown-body" />
          </div>

          <div className="agent-panel__metrics">
            <div>
              <strong>{state.response.retrieval.chunks.length}</strong>
              <span>
                <Database size={13} /> chunks
              </span>
            </div>
            <div>
              <strong>{state.response.retrieval.edges.length}</strong>
              <span>
                <Network size={13} /> edges
              </span>
            </div>
            <div>
              <strong>{confidence}%</strong>
              <span>
                <ShieldCheck size={13} /> confidence
              </span>
            </div>
          </div>

          <div className="agent-panel__section">
            <h3>
              <FileText size={14} /> Retrieved chunks
            </h3>
            {state.response.retrieval.chunks.slice(0, 4).map((row, index) => (
              <div key={row.chunk.id} className="agent-panel__chunk">
                <div className="agent-panel__chunk-head">
                  <strong>{row.chunk.text.split(".")[0]}</strong>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <p>{row.chunk.text}</p>
                <div className="agent-panel__score">
                  <span style={{ width: `${Math.max(row.score * 100, 8)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="agent-panel__section">
            <h3>
              <Route size={14} /> Graph path
            </h3>
            {state.response.retrieval.edges.slice(0, 6).map((row) => (
              <div key={row.edge.id} className="agent-panel__edge">
                <span>{row.edge.type}</span>
                <p>{row.edge.provenance || "derived relation"}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="agent-panel__empty">
          <BrainCircuit size={22} />
          <strong>Ready for retrieval</strong>
          <span>Ask a question to inspect chunks, graph expansion, citations, and execution traces.</span>
        </div>
      )}
    </aside>
  );
}
