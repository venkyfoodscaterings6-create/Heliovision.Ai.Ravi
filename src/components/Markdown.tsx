import { Brain, Check, ChevronDown, Copy } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useWorkspace } from "../store/useWorkspace";

const KEYWORDS = /^(const|let|var|function|return|if|else|for|while|async|await|import|from|export|default|type|interface|class|new|try|catch|throw|of|in|true|false|null|undefined)$/;

function highlight(source: string): ReactNode {
  const pattern = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b(?:const|let|var|function|return|if|else|for|while|async|await|import|from|export|default|type|interface|class|new|try|catch|throw|of|in|true|false|null|undefined)\b)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*(?=\())/g;
  const result: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(source))) {
    if (match.index > last) result.push(source.slice(last, match.index));
    const value = match[0];
    if (match[1]) result.push(<span key={index++} className="tok-comment">{value}</span>);
    else if (match[2]) result.push(<span key={index++} className="tok-str">{value}</span>);
    else if (match[3] || KEYWORDS.test(value)) result.push(<span key={index++} className="tok-key">{value}</span>);
    else if (match[4]) result.push(<span key={index++} className="tok-num">{value}</span>);
    else if (match[5]) result.push(<span key={index++} className="tok-fn">{value}</span>);
    else result.push(value);
    last = match.index + value.length;
  }
  if (last < source.length) result.push(source.slice(last));
  return result;
}

export function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    useWorkspace.getState().toast("Code copied");
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="font-medium uppercase tracking-[0.06em]">{language || "code"}</span>
        <button onClick={copy} className="flex h-7 items-center gap-1.5 rounded px-2 text-[11px] text-[var(--text-muted-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]" aria-label="Copy code">
          {copied ? <Check size={13} strokeWidth={1.5} /> : <Copy size={13} strokeWidth={1.5} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre><code>{highlight(code)}</code></pre>
    </div>
  );
}

export function ThinkingBlock({ text, duration, streaming }: { text: string; duration?: number; streaming?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-5 overflow-hidden rounded-[12px] border border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--surface-hover)_48%,transparent)]">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[12px] text-[var(--text-muted-strong)] hover:text-[var(--text)]" aria-expanded={open}>
        <Brain size={14} strokeWidth={1.5} className="text-[var(--accent-text)]" />
        <span>{streaming ? "Thinking" : `Thought for ${duration ? Math.max(1, Math.round(duration / 1000)) : 4}s`}</span>
        {streaming && <span className="size-1.5 animate-pulse-soft rounded-full bg-[var(--accent)]" />}
        <ChevronDown size={14} strokeWidth={1.5} className={`ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="max-h-72 overflow-y-auto border-t border-[var(--border-soft)] px-4 py-3 font-sans text-[12.5px] leading-[1.7] text-[var(--text-muted-strong)] whitespace-pre-wrap">{text}</div>}
    </div>
  );
}

function inline(text: string, keyPrefix = "i"): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\$[^$\n]+\$)/g;
  const parts = text.split(pattern);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*\n]+\*$/.test(part)) return <em key={key}>{part.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(part)) return <code key={key}>{part.slice(1, -1)}</code>;
    if (/^\$[^$\n]+\$$/.test(part)) return <span key={key} className="mx-[1px] rounded bg-[var(--code-bg)] px-1 font-serif italic">{part.slice(1, -1)}</span>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a key={key} href={link[2]} target="_blank" rel="noreferrer noopener">{link[1]}</a>;
    return part;
  });
}

function Table({ rows }: { rows: string[][] }) {
  if (rows.length < 2) return null;
  const headers = rows[0];
  const body = rows.slice(2).filter((row) => !row.every((cell) => /^:?-{2,}:?$/.test(cell.trim())));
  return (
    <div className="my-5 overflow-x-auto rounded-[8px] border border-[var(--border)]">
      <table>
        <thead><tr>{headers.map((header, index) => <th key={index}>{inline(header.replace(/\*\*/g, ""), `h${index}`)}</th>)}</tr></thead>
        <tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{inline(cell, `c${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function Markdown({ content, streaming = false }: { content: string; streaming?: boolean }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  let key = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      index++;
      while (index < lines.length && !lines[index].startsWith("```")) { codeLines.push(lines[index]); index++; }
      index++;
      blocks.push(<CodeBlock key={key++} language={language} code={codeLines.join("\n")} />);
      continue;
    }
    if (/^\s*\|.+\|\s*$/.test(line) && index + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[index + 1])) {
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|")) {
        const row = lines[index].trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((cell) => cell.trim());
        rows.push(row);
        index++;
      }
      blocks.push(<Table key={key++} rows={rows} />);
      continue;
    }
    if (!line.trim()) { index++; continue; }
    if (/^#{1,6}\s/.test(line)) {
      const level = (line.match(/^#+/) ?? ["#"])[0].length;
      const text = line.replace(/^#{1,6}\s+/, "");
      if (level === 1) blocks.push(<h1 key={key++}>{inline(text, `h${key}`)}</h1>);
      else if (level === 2) blocks.push(<h2 key={key++}>{inline(text, `h${key}`)}</h2>);
      else if (level === 3) blocks.push(<h3 key={key++}>{inline(text, `h${key}`)}</h3>);
      else blocks.push(<h4 key={key++} className="mb-2 mt-4 font-sans text-[13px] font-semibold uppercase tracking-wide">{inline(text, `h${key}`)}</h4>);
      index++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) { quote.push(lines[index].replace(/^>\s?/, "")); index++; }
      blocks.push(<blockquote key={key++}>{quote.map((q, i) => <div key={i}>{inline(q, `q${i}`)}</div>)}</blockquote>);
      continue;
    }
    if (/^\s*[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*+]\s/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*+]\s+/, ""));
        index++;
        while (index < lines.length && /^\s{2,}\S/.test(lines[index]) && !/^\s*[-*+]\s/.test(lines[index])) {
          items[items.length - 1] += " " + lines[index].trim();
          index++;
        }
      }
      blocks.push(<ul key={key++}>{items.map((item, i) => <li key={i}>{inline(item, `l${i}`)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s/.test(lines[index])) { items.push(lines[index].replace(/^\s*\d+\.\s+/, "")); index++; }
      blocks.push(<ol key={key++}>{items.map((item, i) => <li key={i}>{inline(item, `o${i}`)}</li>)}</ol>);
      continue;
    }
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*]*$/.test(line)) { blocks.push(<hr key={key++} />); index++; continue; }
    const paragraph: string[] = [line];
    index++;
    while (index < lines.length && lines[index].trim() && !/^(#{1,6}\s|>\s?|\s*[-*+]\s|\s*\d+\.\s|```)/.test(lines[index]) && !lines[index].includes("|")) {
      paragraph.push(lines[index]);
      index++;
    }
    blocks.push(<p key={key++}>{inline(paragraph.join(" "), `p${key}`)}</p>);
  }
  return <div className={`prose-hv ${streaming ? "stream-cursor" : ""}`}>{blocks}</div>;
}
