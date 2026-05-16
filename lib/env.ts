import { appEnvSchema, type AppEnv } from "@/schemas/env";

let cachedEnv: AppEnv | null = null;

export function getAppEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = appEnvSchema.parse({
    APP_ENV: process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    CONVEX_DEPLOYMENT: process.env.CONVEX_DEPLOYMENT,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
    LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  return cachedEnv;
}
