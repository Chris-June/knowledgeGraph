import { z } from "zod";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const knowledgeGraphExplainerSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
});

type KnowledgeGraphExplainerProps = z.infer<typeof knowledgeGraphExplainerSchema>;

export function KnowledgeGraphExplainer(props: KnowledgeGraphExplainerProps) {
  const { title, subtitle } = knowledgeGraphExplainerSchema.parse(props);
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#050505", color: "white", justifyContent: "center", padding: 120 }}>
      <div style={{ opacity }}>
        <h1 style={{ fontFamily: "Geist, sans-serif", fontSize: 92, margin: 0 }}>{title}</h1>
        <p style={{ fontFamily: "Geist, sans-serif", fontSize: 36, color: "#94a3b8", maxWidth: 960 }}>{subtitle}</p>
      </div>
    </AbsoluteFill>
  );
}
