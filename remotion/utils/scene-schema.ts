import { z } from "zod";

export const sceneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  narration: z.string().optional(),
  durationInFrames: z.number().int().positive(),
  assetRefs: z.array(z.string()).default([]),
});

export type SceneSchema = z.infer<typeof sceneSchema>;
