import { Braces, Code2, Download, Eye, FileCode2, FileText, FileType2, Loader2, Maximize2, Minimize2, Sheet, Table2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { downloadFile, FORMAT_META, parseMarkdownTables } from "../lib/formats";
import type { GeneratedFile, FileFormat } from "../lib/types";
import { Markdown } from "./Markdown";
import { Tip } from "./ui";
import { useWorkspace } from "../store/useWorkspace";

const FILE_ICONS: Record<FileFormat, typeof FileText> = {
  xlsx: Sheet,
  csv: Table2,
  docx: FileType2,
  pdf: FileText,
  html: Code2,
  md: FileText,
  json: Braces,
  txt: FileText,
};

function shortSize(size = 0) {
  if (!size) return "Ready";
  if (size < 1024) return `${size} B`;
  return `${(size / 1024).toFixed(1)} KB`;
}

export function FileCard({ file, onPreview }: { file: GeneratedFile; onPreview: (file: GeneratedFile) => void }) {
  const { toast } = useWorkspace();
  const [downloading, setDownloading] = useState(false);
  const Icon = FILE_ICONS[file.format] ?? FileCode2;
  const meta = FORMAT_META[file.format];
  const download = async () => {
    try {
      setDownloading(true);
      await downloadFile(file);
      toast(`${meta.label} downloaded`);
    } catch {
      toast("Could not generate that file. Please try again.");
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className="my-4 flex w-full max-w-[520px] items-center gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-3 font-sans shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[9px] bg-[var(--accent-soft)] text-[var(--accent-text)]"><Icon size={19} strokeWidth={1.5} /></span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-[500] leading-tight text-[var(--text)]">{file.name}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-[var(--text-muted)]">
          <span className="rounded bg-[var(--surface-hover)] px-1.5 py-[1px] font-medium uppercase tracking-wide">{meta.label}</span>
          <span>·</span><span>{shortSize(file.size)}</span><span>·</span><span>Generated locally</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Tip label="Preview file"><button onClick={() => onPreview(file)} className="hv-icon-btn" aria-label={`Preview ${file.name}`}><Eye size={15} strokeWidth={1.5} /></button></Tip>
        <Tip label="Download"><button onClick={download} disabled={downloading} className="hv-icon-btn" aria-label={`Download ${file.name}`}>{downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} strokeWidth={1.5} />}</button></Tip>
      </div>
    </div>
  );
}

function SheetPreview({ file }: { file: GeneratedFile }) {
  const tables = useMemo(() => parseMarkdownTables(file.content), [file.content]);
  const [active, setActive] = useState(0);
  if (!tables.length) return <div className="p-8 text-center text-[12px] text-[var(--text-muted)]">No tables found in this file. Switch to Code to inspect its contents.</div>;
  const table = tables[Math.min(active, tables.length - 1)];
  return (
    <div className="flex h-full flex-col">
      {tables.length > 1 && (
        <div className="flex shrink-0 items-end gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--code-bg)] px-3 pt-3">
          {tables.map((tab, index) => (
            <button key={index} onClick={() => setActive(index)} className={`relative rounded-t-md border border-b-0 px-3 py-1.5 text-[11.5px] ${index === active ? "border-[var(--border)] bg-[var(--surface)] font-medium" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
              {tab.title}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-3 flex items-center gap-2 font-sans text-[11px] text-[var(--text-muted)]"><span className="flex size-5 items-center justify-center rounded bg-[#217346] text-[9px] font-semibold text-white">X</span>{file.name}</div>
        <table className="w-full border-collapse font-sans text-[12px]">
          <thead><tr>{table.headers.map((header, i) => <th key={i} className="sticky top-0 border border-[var(--border)] bg-[var(--surface-hover)] px-2.5 py-2 text-left font-medium text-[var(--text-muted-strong)]">{header.replace(/\*\*/g, "")}</th>)}</tr></thead>
          <tbody>{table.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => {
            const numeric = /^[£$€]?-?[\d,.]+%?$/.test(cell.replace(/\*\*/g, "").trim());
            return <td key={c} className={`border border-[var(--border)] px-2.5 py-1.5 ${numeric ? "text-right tabular-nums" : ""}`}>{cell.replace(/\*\*/g, "").replace(/\\\|/g, "|")}</td>;
          })}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

export function PreviewPanel({ file, onClose }: { file: GeneratedFile; onClose: () => void }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [wide, setWide] = useState(false);
  const meta = FORMAT_META[file.format];
  const Icon = FILE_ICONS[file.format] ?? FileText;
  const { toast } = useWorkspace();

  const copy = async () => {
    await navigator.clipboard.writeText(file.content);
    setCopied(true);
    toast("File content copied");
    window.setTimeout(() => setCopied(false), 1500);
  };
  const download = async () => {
    await downloadFile(file);
    toast(`${meta.label} downloaded`);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <section className={`z-[55] flex min-h-0 flex-col border-l border-[var(--border)] bg-[var(--bg)] shadow-[-8px_0_32px_rgba(31,30,29,0.04)] max-md:fixed max-md:inset-0 max-md:z-[65] ${wide ? "md:w-[70%]" : "md:w-[46%] md:min-w-[360px] md:max-w-[680px]"}`} aria-label="File preview">
      <header className="flex h-[54px] shrink-0 items-center gap-3 border-b border-[var(--border)] px-3.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent-text)]"><Icon size={14} strokeWidth={1.5} /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-[500] leading-tight">{file.name}</div>
          <div className="text-[10px] text-[var(--text-muted)]">Generated locally · {meta.label}</div>
        </div>
        <div className="flex items-center gap-0.5">
          <Tip label="Copy contents"><button onClick={copy} className="hv-icon-btn" aria-label="Copy contents">{copied ? <span className="text-[10px] font-medium text-[var(--success)]">Copied</span> : <Code2 size={15} strokeWidth={1.5} />}</button></Tip>
          <Tip label="Download"><button onClick={download} className="hv-icon-btn" aria-label="Download file"><Download size={15} strokeWidth={1.5} /></button></Tip>
          <Tip label={wide ? "Restore width" : "Expand panel"}><button onClick={() => setWide(!wide)} className="hv-icon-btn hidden md:inline-flex">{wide ? <Minimize2 size={15} strokeWidth={1.5} /> : <Maximize2 size={15} strokeWidth={1.5} />}</button></Tip>
          <Tip label="Close preview"><button onClick={onClose} className="hv-icon-btn" aria-label="Close preview"><X size={16} strokeWidth={1.5} /></button></Tip>
        </div>
      </header>
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-[var(--border-soft)] px-3">
        {(["preview", "code"] as const).map((item) => (
          <button key={item} onClick={() => setTab(item)} className={`relative h-full px-2.5 text-[11.5px] capitalize transition-colors ${tab === item ? "text-[var(--text)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
            {item}
            {tab === item && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[var(--accent)]" />}
          </button>
        ))}
        <span className="ml-auto font-sans text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{meta.label}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "code" ? (
          <div className="h-full overflow-auto bg-[var(--code-bg)] p-4">
            <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-[1.7] text-[var(--text-muted-strong)]">{file.content}</pre>
          </div>
        ) : file.format === "xlsx" || file.format === "csv" ? (
          <SheetPreview file={file} />
        ) : file.format === "html" ? (
          <iframe title={`${file.name} preview`} sandbox="" srcDoc={file.content} className="h-full w-full border-0 bg-white" />
        ) : file.format === "pdf" ? (
          <div className="h-full overflow-auto p-4 sm:p-7">
            <div className="mx-auto max-w-[540px] rounded-[2px] bg-white px-7 py-9 shadow-[0_4px_24px_rgba(20,20,19,0.12)] sm:px-10 sm:py-12">
              <div className="mb-2 font-sans text-[9px] font-medium uppercase tracking-[0.18em] text-[#b04e2d]">HelioVision.Ai</div>
              <h2 className="mb-6 font-serif text-[24px] leading-tight text-[#141413]">{file.name.replace(/\.[^.]+$/, "")}</h2>
              <div className="text-[#2c2c2a] [&_.prose-hv]:text-[12.5px] [&_.prose-hv]:leading-[1.7]"><Markdown content={file.content} /></div>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto bg-[var(--surface)] p-5 sm:p-7">
            {file.format === "md" ? <Markdown content={file.content} /> : <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-[1.7] text-[var(--text)]">{file.content}</pre>}
          </div>
        )}
      </div>
    </section>
  );
}
