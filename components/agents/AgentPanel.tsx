"use client";

import { Bot, BrainCircuit, CheckCircle2, Clock3, Database, FileText, Network, Route, Send, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { AIContentRenderer } from "@/components/ai/AIContentRenderer";
import type { AgentQueryResponse, GraphSuggestion } from "@/schemas/graph-rag";

type AgentPanelState = {
  query: string;
  loading: boolean;
  suggestionsLoading: boolean;
  response: AgentQueryResponse | null;
  suggestions: GraphSuggestion[];
  error: string | null;
};

export function AgentPanel() {
  const [state, setState] = useState<AgentPanelState>({
    query: "What connects React and Node.js?",
    loading: false,
    suggestionsLoading: false,
    response: null,
    suggestions: [],
    error: null,
  });

  useEffect(() => {
    void loadSuggestions();
  }, []);

  async function loadSuggestions() {
    try {
      const response = await fetch("/api/agents/suggestions?ownerId=local-user&organizationId=local-org&status=pending");
      if (!response.ok) {
        throw new Error(`Suggestion load failed with ${response.status}`);
      }
      const data = (await response.json()) as { suggestions: GraphSuggestion[] };
      setState((current) => ({ ...current, suggestions: data.suggestions }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Unknown suggestion error",
      }));
    }
  }

  async function proposeSuggestions() {
    setState((current) => ({ ...current, suggestionsLoading: true, error: null }));

    try {
      const response = await fetch("/api/agents/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ownerId: "local-user",
          organizationId: "local-org",
          limit: 6,
        }),
      });

      if (!response.ok) {
        throw new Error(`Suggestion generation failed with ${response.status}`);
      }

      const data = (await response.json()) as { suggestions: GraphSuggestion[] };
      setState((current) => ({ ...current, suggestionsLoading: false, suggestions: data.suggestions }));
    } catch (error) {
      setState((current) => ({
        ...current,
        suggestionsLoading: false,
        error: error instanceof Error ? error.message : "Unknown suggestion error",
      }));
    }
  }

  async function reviewSuggestion(suggestionId: string, action: "approve" | "reject") {
    setState((current) => ({ ...current, suggestionsLoading: true, error: null }));

    try {
      const response = await fetch(`/api/agents/suggestions/${suggestionId}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewedBy: "local-user",
          rejectionReason: action === "reject" ? "Rejected from review queue" : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Suggestion ${action} failed with ${response.status}`);
      }

      setState((current) => ({
        ...current,
        suggestionsLoading: false,
        suggestions: current.suggestions.filter((suggestion) => suggestion.id !== suggestionId),
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        suggestionsLoading: false,
        error: error instanceof Error ? error.message : "Unknown suggestion review error",
      }));
    }
  }

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

      <div className="agent-panel__section agent-panel__review">
        <div className="agent-panel__section-head">
          <h3>
            <ShieldCheck size={14} /> Review queue
          </h3>
          <button type="button" onClick={() => void proposeSuggestions()} disabled={state.suggestionsLoading}>
            {state.suggestionsLoading ? "Scanning" : "Find suggestions"}
          </button>
        </div>
        {state.suggestions.length > 0 ? (
          state.suggestions.slice(0, 3).map((suggestion) => (
            <div key={suggestion.id} className="agent-panel__suggestion">
              <div>
                <span>{suggestion.type}</span>
                <strong>{suggestion.proposedNode?.label ?? suggestion.proposedEdge?.type ?? "Graph suggestion"}</strong>
              </div>
              <p>{suggestion.rationale}</p>
              <blockquote>{suggestion.sourceText}</blockquote>
              <div className="agent-panel__suggestion-actions">
                <small>{Math.round(suggestion.confidence * 100)}% confidence</small>
                <button type="button" onClick={() => void reviewSuggestion(suggestion.id, "reject")}>
                  Reject
                </button>
                <button type="button" onClick={() => void reviewSuggestion(suggestion.id, "approve")}>
                  Approve
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="agent-panel__review-empty">No pending graph suggestions.</div>
        )}
      </div>

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

          <div className="agent-panel__section">
            <h3>
              <Clock3 size={14} /> Tool trace
            </h3>
            {state.response.toolExecutions.map((execution) => (
              <div key={execution.id} className="agent-panel__tool">
                <span className={execution.success ? "agent-panel__tool-status success" : "agent-panel__tool-status error"}>
                  {execution.success ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                </span>
                <div>
                  <strong>{execution.toolName}</strong>
                  <p>{execution.resultSummary}</p>
                </div>
                <time>{execution.latencyMs}ms</time>
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
