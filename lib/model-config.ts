import { z } from "zod";

export const gpt5ModelSchema = z.enum(["gpt-5", "gpt-5-mini", "gpt-5-nano"]);

export type Gpt5Model = z.infer<typeof gpt5ModelSchema>;

export const defaultModelConfig = {
  defaultModel: "gpt-5-nano" satisfies Gpt5Model,
  permittedModels: ["gpt-5", "gpt-5-mini", "gpt-5-nano"] satisfies Gpt5Model[],
} as const;
