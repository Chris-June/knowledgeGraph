import { knowledgeGraphSchema, type GraphLink, type GraphNode, type KnowledgeGraph } from "@/schemas/graph";

export interface GraphRepository {
  getDefaultGraph(): Promise<KnowledgeGraph>;
  saveGraph(graph: KnowledgeGraph): Promise<KnowledgeGraph>;
}

export interface GraphImportService {
  importMarkdown(markdown: string): Promise<KnowledgeGraph>;
}

export interface GraphService {
  loadWorkspaceGraph(): Promise<KnowledgeGraph>;
  persistWorkspaceGraph(graph: KnowledgeGraph): Promise<KnowledgeGraph>;
}

export class LocalSeedGraphRepository implements GraphRepository {
  constructor(private readonly seedGraph: KnowledgeGraph) {}

  async getDefaultGraph() {
    return knowledgeGraphSchema.parse(this.seedGraph);
  }

  async saveGraph(graph: KnowledgeGraph) {
    return knowledgeGraphSchema.parse(graph);
  }
}

export function createGraphNode(input: GraphNode) {
  return input;
}

export function createGraphLink(input: GraphLink) {
  return input;
}
