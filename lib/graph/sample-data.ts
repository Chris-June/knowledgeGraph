import { knowledgeGraphSchema, type KnowledgeGraph } from "@/schemas/graph";

import { processLinks } from "./link-utils";

export function generateSampleGraph(): KnowledgeGraph {
  const nodes = [
    { id: "Web Development", group: 1, val: 30, desc: "The process of building websites." },
    { id: "React", group: 2, val: 25, desc: "A JavaScript library for building user interfaces." },
    { id: "Vue", group: 2, val: 18, desc: "The Progressive JavaScript Framework." },
    { id: "Angular", group: 2, val: 18, desc: "Platform for building mobile and desktop web applications." },
    { id: "JavaScript", group: 3, val: 28, desc: "The programming language of the Web." },
    { id: "TypeScript", group: 3, val: 24, desc: "JavaScript with syntax for types." },
    { id: "HTML", group: 3, val: 15, desc: "Standard markup language." },
    { id: "CSS", group: 3, val: 15, desc: "Style sheet language." },
    { id: "Vite", group: 4, val: 20, desc: "Next Generation Frontend Tooling." },
    { id: "Webpack", group: 4, val: 15, desc: "A static module bundler." },
    { id: "TailwindCSS", group: 5, val: 18, desc: "A utility-first CSS framework." },
    { id: "Backend Development", group: 1, val: 30, desc: "Server-side development." },
    { id: "Node.js", group: 6, val: 25, desc: "JavaScript runtime." },
    { id: "Python", group: 6, val: 25, desc: "Programming language." },
    { id: "Express", group: 7, val: 18, desc: "Web framework for Node.js." },
    { id: "Django", group: 7, val: 15, desc: "Python Web framework." },
    { id: "Databases", group: 1, val: 30, desc: "Structured information." },
    { id: "PostgreSQL", group: 8, val: 22, desc: "Relational Database." },
    { id: "MongoDB", group: 8, val: 20, desc: "Document database." },
    { id: "GraphQL", group: 9, val: 20, desc: "A query language for your API." },
    { id: "REST API", group: 9, val: 18, desc: "Representational state transfer." },
  ];

  const links = processLinks([
    { source: "React", target: "JavaScript", name: "built with", type: "dependency", weight: 5 },
    { source: "Vue", target: "JavaScript", name: "built with", type: "dependency", weight: 4 },
    { source: "Angular", target: "TypeScript", name: "built with", type: "dependency", weight: 4 },
    { source: "React", target: "Web Development", name: "part of", type: "part_of", weight: 3 },
    { source: "Vue", target: "Web Development", name: "part of", type: "part_of", weight: 3 },
    { source: "Angular", target: "Web Development", name: "part of", type: "part_of", weight: 3 },
    { source: "JavaScript", target: "Web Development", name: "core", type: "core", weight: 4 },
    { source: "TypeScript", target: "JavaScript", name: "superset", type: "core", weight: 4 },
    { source: "Vite", target: "React", name: "tools", type: "tooling", weight: 3 },
    { source: "Vite", target: "Vue", name: "tools", type: "tooling", weight: 3 },
    { source: "Webpack", target: "React", name: "tools", type: "tooling", weight: 2 },
    { source: "TailwindCSS", target: "CSS", name: "framework", type: "tooling", weight: 3 },
    { source: "TailwindCSS", target: "React", name: "styling for", type: "dependency", weight: 3 },
    { source: "Node.js", target: "JavaScript", name: "runtime", type: "dependency", weight: 5 },
    { source: "Node.js", target: "Backend Development", name: "part of", type: "part_of", weight: 4 },
    { source: "Python", target: "Backend Development", name: "core", type: "core", weight: 4 },
    { source: "Express", target: "Node.js", name: "framework", type: "dependency", weight: 4 },
    { source: "Django", target: "Python", name: "framework", type: "dependency", weight: 3 },
    { source: "PostgreSQL", target: "Databases", name: "type", type: "part_of", weight: 3 },
    { source: "MongoDB", target: "Databases", name: "type", type: "part_of", weight: 3 },
    { source: "Backend Development", target: "Databases", name: "uses", type: "dependency", weight: 4 },
    { source: "Web Development", target: "Backend Development", name: "connects to", type: "related", weight: 2 },
    { source: "GraphQL", target: "Web Development", name: "API standard", type: "related", weight: 3 },
    { source: "GraphQL", target: "Backend Development", name: "API standard", type: "related", weight: 3 },
    { source: "React", target: "Node.js", name: "SSR Server", type: "tooling", weight: 2 },
    { source: "React", target: "Node.js", name: "Build Env", type: "dependency", weight: 1 },
    { source: "JavaScript", target: "Node.js", name: "Runs on", type: "core", weight: 3 },
  ]);

  return knowledgeGraphSchema.parse({ nodes, links });
}
