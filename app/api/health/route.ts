import { NextResponse } from "next/server";

import { getAppEnv } from "@/lib/env";

export function GET() {
  const env = getAppEnv();

  return NextResponse.json({
    ok: true,
    app: "knowledge-graph-platform",
    environment: env.APP_ENV,
    convexConfigured: Boolean(env.NEXT_PUBLIC_CONVEX_URL && env.CONVEX_DEPLOYMENT),
    aiConfigured: Boolean(env.OPENAI_API_KEY),
  });
}
