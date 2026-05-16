import type { AgentInputItem, Session } from "@openai/agents";

import type { AgentSessionRepository } from "@/services/graph-rag-repository";

export class ConvexBackedAgentSession implements Session {
  constructor(
    private readonly sessionId: string,
    private readonly repository: AgentSessionRepository,
  ) {}

  async getSessionId() {
    return this.sessionId;
  }

  async getItems(limit?: number) {
    const items = await this.repository.getSessionItems(this.sessionId);
    return typeof limit === "number" ? items.slice(Math.max(items.length - limit, 0)) : items;
  }

  async addItems(items: AgentInputItem[]) {
    await this.repository.appendSessionItems(this.sessionId, items);
  }

  async popItem() {
    return this.repository.popSessionItem(this.sessionId);
  }

  async clearSession() {
    await this.repository.clearSession(this.sessionId);
  }
}
