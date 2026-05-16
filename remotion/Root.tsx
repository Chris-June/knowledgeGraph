import { Composition } from "remotion";

import { KnowledgeGraphExplainer, knowledgeGraphExplainerSchema } from "./compositions/KnowledgeGraphExplainer";

export function RemotionRoot() {
  return (
    <Composition
      id="KnowledgeGraphExplainer"
      component={KnowledgeGraphExplainer}
      durationInFrames={180}
      fps={30}
      width={1920}
      height={1080}
      schema={knowledgeGraphExplainerSchema}
      defaultProps={{
        title: "Knowledge Graph Platform",
        subtitle: "Structured reasoning, rendered as an operating system.",
      }}
    />
  );
}
