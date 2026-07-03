"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * Renders site inline markup as styled JSX:
 * **bold** · *word* = green gradient · ~word~ = red · [label](href) = link.
 * Links render as non-navigating spans (this is a preview, not the site).
 */
const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|~[^~]+~|\[[^\]]+\]\([^)]*\))/g;

const greenStyle: CSSProperties = {
  background: "linear-gradient(120deg, #5CB800, #2E6B00)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "#2E6B00",
  fontWeight: 700,
};

const redStyle: CSSProperties = { color: "#CC2200", fontWeight: 600 };

const linkStyle: CSSProperties = {
  color: "#2E6B00",
  fontWeight: 600,
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};

export default function InlinePreview({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) {
      parts.push(<strong key={key++}>{t.slice(2, -2)}</strong>);
    } else if (t.startsWith("*")) {
      parts.push(<span key={key++} style={greenStyle}>{t.slice(1, -1)}</span>);
    } else if (t.startsWith("~")) {
      parts.push(<span key={key++} style={redStyle}>{t.slice(1, -1)}</span>);
    } else {
      parts.push(
        <span key={key++} style={linkStyle}>{t.slice(1, t.indexOf("]("))}</span>
      );
    }
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className={className}>{parts.length > 0 ? parts : " "}</span>;
}
