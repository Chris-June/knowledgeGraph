import { z } from "zod";

export const toolExecutionContextSchema = z.object({
  actorId: z.string().min(1),
  requestId: z.string().min(1),
  environment: z.enum(["development", "staging", "production"]),
});

export type ToolExecutionContext = z.infer<typeof toolExecutionContextSchema>;

export type ToolDefinition<Input, Output> = {
  name: string;
  description: string;
  inputSchema: z.ZodType<Input>;
  execute: (input: Input, context: ToolExecutionContext) => Promise<Output>;
};

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<unknown, unknown>>();

  register<Input, Output>(tool: ToolDefinition<Input, Output>) {
    this.tools.set(tool.name, tool as ToolDefinition<unknown, unknown>);
  }

  get(name: string) {
    return this.tools.get(name);
  }

  list() {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }
}

export const toolRegistry = new ToolRegistry();
