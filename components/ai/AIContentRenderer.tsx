"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

type CodeProps = {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
};

type AIContentRendererProps = {
  content: string;
  className?: string;
};

function CodeBlock({ inline, className, children }: CodeProps) {
  const [copied, setCopied] = useState(false);
  const code = String(children ?? "").replace(/\n$/, "");

  if (inline) {
    return <code className={className}>{children}</code>;
  }

  const language = className?.replace("language-", "") ?? "text";

  return (
    <div className="my-3 overflow-hidden rounded-md border border-white/10 bg-black/40">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-slate-400">
        <span>{language}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-300 transition hover:bg-white/10 hover:text-white"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-sm">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

export function AIContentRenderer({ content, className }: AIContentRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: "wrap" }],
          rehypeSanitize,
        ]}
        components={{
          code: CodeBlock,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
