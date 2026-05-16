import { z } from "zod";

import { defaultModelConfig, gpt5ModelSchema } from "@/lib/model-config";

export const aiRequestSchema = z.object({
  route: z.string().min(1),
  model: gpt5ModelSchema.default(defaultModelConfig.defaultModel),
  input: z.string().min(1),
  metadata: z.record(z.string(), z.string()).default({}),
});

export const aiResponseSchema = z.object({
  route: z.string().min(1),
  model: gpt5ModelSchema,
  output: z.string(),
  citations: z.array(z.string()).default([]),
});

export type AiRequest = z.infer<typeof aiRequestSchema>;
export type AiResponse = z.infer<typeof aiResponseSchema>;

export interface AiOrchestrator {
  run(request: AiRequest): Promise<AiResponse>;
}

export class ContractOnlyAiOrchestrator implements AiOrchestrator {
  async run(request: AiRequest): Promise<AiResponse> {
    const parsed = aiRequestSchema.parse(request);

    return aiResponseSchema.parse({
      route: parsed.route,
      model: parsed.model,
      output: "",
      citations: [],
    });
  }
}
