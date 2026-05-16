import { z } from "zod";

export const appEnvSchema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  CONVEX_DEPLOYMENT: z.string().min(1).optional(),
  NEXT_PUBLIC_CONVEX_URL: z.url().optional(),
  LANGFUSE_SECRET_KEY: z.string().min(1).optional(),
  LANGFUSE_PUBLIC_KEY: z.string().min(1).optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
});

export type AppEnv = z.infer<typeof appEnvSchema>;
