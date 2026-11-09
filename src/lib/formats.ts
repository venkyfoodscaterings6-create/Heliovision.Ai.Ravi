import type { FileFormat, GeneratedFile } from "./types";
import { uid } from "./seed";

export const FORMAT_META: Record<FileFormat, { label: string; extension: string; description: string; mime: string }> = {
  xlsx: { label: "Excel", extension: "xlsx", description: "Formatted workbook", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  csv: { label: "CSV", extension: "csv", description: "Plain tabular data", mime: "text/csv" },
  docx: { label: "Word", extension: "docx", description: "Editable document", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  pdf: { label: "PDF", extension: "pdf", description: "Polished, portable document", mime: "application/pdf" },
  html: { label: "HTML", extension: "html", description: "Self-contained web page", mime: "text/html" },
  md: { label: "Markdown", extension: "md", description: "Portable rich text", mime: "text/markdown" },
  json: { label: "JSON", extension: "json", description: "Structured data", mime: "application/json" },
  txt: { label: "Text", extension: "txt", description: "Plain text", mime: "text/plain" },
};

const DETECTION: { format: FileFormat; patterns: RegExp[] }[] = [
  { format: "xlsx", patterns: [/\bexcel\b/i, /\bxlsx?\b/i, /\bspreadsheet\b/i, /\bworkbook\b/i] },
  { format: "docx", patterns: [/\bword (document|file|doc)\b/i, /\bms word\b/i, /\b(export|send|give|make|turn|save|download)[^.]{0,24}\bword\b/i, /\bto word\b/i, /\bdocx?\b/i, /\bdownloadable (document|report)\b/i] },
  { format: "pdf", patterns: [/\bpdf\b/i, /\bprintable (report|document)\b/i] },
  { format: "csv", patterns: [/[\s,](as|to|in|export|download)( a| an| the)? csv\b/i, /\bcsv\b/i] },
  { format: "html", patterns: [/\bhtml\b/i, /\bweb ?page\b/i, /\blanding page\b/i, /\bself[- ]contained (page|document)\b/i] },
  { format: "json", patterns: [/\bjson\b/i, /\bstructured data\b/i] },
  { format: "md", patterns: [/\bmarkdown\b/i, /\b\.md\b/i] },
  { format: "txt", patterns: [/\bplain text\b/i, /\btext file\b/i, /\bas a txt\b/i] },
];

export function detectFormat(message: string, enabled?: FileFormat[]): FileFormat | null {
  for (const item of DETECTION) {
    if (enabled && !enabled.includes(item.format)) continue;
    if (item.patterns.some((pattern) => pattern.test(message))) return item.format;
  }
  return null;
}

export function formatInstruction(format: FileFormat): string {
  const meta = FORMAT_META[format];
  return `\n\nOUTPUT FORMAT: The user wants a downloadable ${meta.label} file. Produce polished, complete content. Use markdown tables for tabular data (they will become sheet tabs). Do not add a meta-commentary note about the file format.`;
}

export function slugify(input: string, length = 46): string {
  return input
    .toLowerCase()
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[`*_#>~|]/g, " ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, length)
    .replace(/-$/, "") || "heliovision-export";
}

export function makeFileName(pattern: string, format: FileFormat, prompt: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(prompt, 30);
  let base = pattern
    .replace(/\{date\}/g, date)
    .replace(/\{slug\}/g, slug)
    .replace(/\{format\}/g, format)
    .replace(/[\\/:*?"<>|]/g, "-");
  base = base.replace(new RegExp(`\\.${FORMAT_META[format].extension}$`, "i"), "");
  return `${base || `heliovision-${date}`}.${FORMAT_META[format].extension}`;
}

export interface ParsedTable {
  title: string;
  headers: string[];
  rows: string[][];
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

export function parseMarkdownTables(markdown: string): ParsedTable[] {
  const lines = markdown.split("\n");
  const tables: ParsedTable[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].includes("|") || !/^\s*\|?\s*:?-{2,}/.test(lines[i + 1].replace(/\|/g, "|"))) continue;
    const headers = splitRow(lines[i]);
    const divider = splitRow(lines[i + 1]);
    if (!headers.length || !divider.length) continue;
    const rows: string[][] = [];
    let j = i + 2;
    while (j < lines.length && lines[j].includes("|")) {
      const row = splitRow(lines[j]);
      if (row.some((cell) => cell.length)) rows.push(row);
      j++;
    }
    // Nearest preceding heading, if any.
    let title = `Table ${tables.length + 1}`;
    for (let k = i - 1; k >= Math.max(0, i - 8); k--) {
      const heading = lines[k].match(/^#{1,4}\s+(.+)/);
      if (heading) { title = heading[1].replace(/[*_`]/g, "").slice(0, 28); break; }
    }
    tables.push({ title, headers, rows });
    i = j - 1;
  }
  return tables;
}

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[^\n]*\n?/g, "").replace(/```/g, ""))
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~`>]/g, "")
    .replace(/^\s*[-+]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function markdownToHtml(markdown: string): string {
  let html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    codeBlocks.push(`<pre><code class="language-${lang}">${code}</code></pre>`);
    return `\u0000CODE${codeBlocks.length - 1}\u0000`;
  });
  html = html
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\s)\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>");

  const paragraphs = html.split(/\n{2,}/).map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    if (/^<(h[1-6]|ul|ol|li|blockquote|pre|table|hr)/.test(trimmed) || trimmed.startsWith("\u0000CODE")) {
      if (trimmed.includes("<li>")) return `<ul>${trimmed}</ul>`;
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, "<br />")}</p>`;
  });
  let output = paragraphs.join("\n");
  output = output.replace(/\u0000CODE(\d+)\u0000/g, (_m, i) => codeBlocks[Number(i)]);
  return output;
}

export function toCsv(markdown: string): string {
  const tables = parseMarkdownTables(markdown);
  if (!tables.length) return `"Content"\n"${stripMarkdown(markdown).replace(/"/g, '""')}"`;
  const escape = (cell: string) => `"${cell.replace(/[*_`]/g, "").replace(/"/g, '""')}"`;
  return tables
    .map((table) => [table.headers, ...table.rows].map((row) => row.map(escape).join(",")).join("\n"))
    .join("\n\n");
}

export function toJson(markdown: string): string {
  const tables = parseMarkdownTables(markdown);
  const payload = {
    title: "HelioVision.Ai export",
    generatedAt: new Date().toISOString(),
    content: stripMarkdown(markdown),
    ...(tables.length
      ? {
          tables: tables.map((table) => ({
            title: table.title,
            columns: table.headers.map((h) => h.replace(/\n/g, " ")),
            rows: table.rows.map((row) => Object.fromEntries(table.headers.map((h, i) => [h.replace(/^[^a-zA-Z0-9]+/, ""), row[i] ?? ""]))),
          })),
        }
      : {}),
  };
  return JSON.stringify(payload, null, 2);
}

export function toHtmlDocument(markdown: string, title: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title.replace(/</g, "&lt;")}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #faf9f5; color: #141413; font-family: Georgia, 'Times New Roman', serif; line-height: 1.7; }
  main { max-width: 780px; margin: 0 auto; padding: 64px 28px 88px; }
  h1, h2, h3 { line-height: 1.25; font-weight: 500; letter-spacing: -0.01em; margin: 1.6em 0 .55em; }
  h1 { font-size: 38px; } h2 { font-size: 26px; } h3 { font-size: 20px; }
  p { font-size: 17px; } a { color: #b04e2d; } blockquote { border-left: 3px solid #d97757; margin: 1.5em 0; padding-left: 18px; color: #6b6a64; font-style: italic; }
  table { width: 100%; border-collapse: collapse; font-family: Inter, system-ui, sans-serif; font-size: 14px; margin: 1.5em 0; }
  th, td { border: 1px solid #dedcd1; padding: 10px 12px; text-align: left; } th { background: #f0eee6; font-weight: 500; }
  pre { background: #262624; color: #faf9f5; border-radius: 12px; padding: 18px; overflow: auto; font-size: 13px; }
  code { font-family: 'JetBrains Mono', monospace; }
  .eyebrow { font-family: Inter, sans-serif; text-transform: uppercase; letter-spacing: .16em; font-size: 10px; color: #b04e2d; }
  footer { margin-top: 56px; border-top: 1px solid #dedcd1; padding-top: 18px; font-family: Inter, sans-serif; font-size: 12px; color: #6b6a64; }
</style>
</head>
<body><main><div class="eyebrow">Made with HelioVision.Ai</div><h1>${title.replace(/</g, "&lt;")}</h1>${markdownToHtml(markdown)}<footer>Generated privately in your HelioVision.Ai workspace.</footer></main></body>
</html>`;
}

async function createXlsx(markdown: string, fallbackTitle: string): Promise<Blob> {
  const XLSX = await import("xlsx");
  const tables = parseMarkdownTables(markdown);
  const workbook = XLSX.utils.book_new();
  const source = tables.length ? tables : [{ title: fallbackTitle.slice(0, 28), headers: ["Content"], rows: stripMarkdown(markdown).split("\n").map((line) => [line]) }];
  source.forEach((table, index) => {
    const numeric = (value: string) => {
      const cleaned = value.replace(/[*_`£$€,\s]/g, "").replace(/%$/, "");
      if (cleaned !== "" && !Number.isNaN(Number(cleaned))) return Number(cleaned);
      return value.replace(/[*_`]/g, "");
    };
    const aoa = [table.headers.map((header) => header.replace(/[*_`]/g, "")), ...table.rows.map((row) => row.map(numeric))];
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    sheet["!cols"] = table.headers.map((_, col) => ({
      wch: Math.min(44, Math.max(12, ...aoa.map((row) => String(row[col] ?? "").length + 2))),
    }));
    sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: table.headers.length - 1 } }) };
    XLSX.utils.book_append_sheet(workbook, sheet, `${table.title.replace(/[\\/?*[\]:]/g, "").slice(0, 28) || `Table ${index + 1}`}`);
  });
  const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([data], { type: FORMAT_META.xlsx.mime });
}

async function createDocx(markdown: string, title: string): Promise<Blob> {
  const docx = await import("docx");
  const tables = parseMarkdownTables(markdown);
  const children: any[] = [
    new docx.Paragraph({ text: "HELIOVISION.AI", spacing: { after: 240 }, style: "Title" }),
    new docx.Paragraph({ text: title, heading: docx.HeadingLevel.HEADING_1, spacing: { after: 320 } }),
  ];
  const plain = stripMarkdown(markdown).replace(/\|.+\|/g, "").replace(/\n{3,}/g, "\n\n");
  plain.split("\n\n").forEach((paragraph) => {
    if (!paragraph.trim()) return;
    children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: paragraph.trim(), font: "Georgia", size: 23 })], spacing: { after: 200, line: 330 } }));
  });
  children.push(new docx.Paragraph({ text: "", spacing: { after: 160 } }));
  tables.forEach((table) => {
    children.push(new docx.Paragraph({ text: table.title, heading: docx.HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } }));
    children.push(
      new docx.Table({
        width: { size: 100, type: docx.WidthType.PERCENTAGE },
        rows: [
          new docx.TableRow({ children: table.headers.map((h) => new docx.TableCell({ shading: { fill: "F0EEE6" }, children: [new docx.Paragraph({ children: [new docx.TextRun({ text: h.replace(/[*_`]/g, ""), bold: true })] })] })) }),
          ...table.rows.map((row) => new docx.TableRow({ children: table.headers.map((_, i) => new docx.TableCell({ children: [new docx.Paragraph(row[i]?.replace(/[*_`]/g, "") ?? "")] })) })),
        ],
      }),
    );
  });
  return docx.Packer.toBlob(new docx.Document({ sections: [{ properties: {}, children }] }));
}

async function createPdf(markdown: string, title: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 54;
  let y = 64;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(176, 78, 45);
  doc.text("HELIOVISION.AI", margin, 36);
  doc.setFont("times", "bold");
  doc.setFontSize(24);
  doc.setTextColor(20, 20, 19);
  const titleLines = doc.splitTextToSize(title, pageWidth - margin * 2);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 28 + 16;
  const text = stripMarkdown(markdown).replace(/^[-•]\s*/gm, "— ");
  doc.setFont("times", "normal");
  doc.setFontSize(11.5);
  doc.setTextColor(44, 44, 42);
  const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
  lines.forEach((line: string) => {
    if (y > pageHeight - margin) { doc.addPage(); y = margin; }
    doc.text(line, margin, y);
    y += 17.5;
  });
  if (y > pageHeight - 66) { doc.addPage(); y = margin; }
  doc.setDrawColor(217, 119, 87);
  doc.line(margin, y + 8, margin + 38, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(115, 114, 108);
  doc.text("Generated privately in your HelioVision.Ai workspace.", margin, y + 26);
  return doc.output("blob");
}

export async function buildFile(format: FileFormat, markdown: string, prompt: string, pattern = "heliovision-{date}-{slug}"): Promise<GeneratedFile> {
  const name = makeFileName(pattern, format, prompt);
  const title = stripMarkdown(markdown).split("\n")[0]?.trim().slice(0, 80) || "HelioVision export";
  let content = markdown;
  if (format === "html") content = toHtmlDocument(markdown, title);
  if (format === "json") content = toJson(markdown);
  if (format === "csv") content = toCsv(markdown);
  if (format === "txt") content = stripMarkdown(markdown);
  return { id: uid("file"), name, format, content, createdAt: Date.now(), size: new Blob([content]).size };
}

export async function fileToBlob(file: GeneratedFile): Promise<Blob> {
  switch (file.format) {
    case "xlsx": return createXlsx(file.content, file.name.replace(/\.[^.]+$/, ""));
    case "docx": return createDocx(file.content, file.name.replace(/\.[^.]+$/, ""));
    case "pdf": return createPdf(file.content, file.name.replace(/\.[^.]+$/, ""));
    case "html": return new Blob([file.content], { type: FORMAT_META.html.mime });
    default: return new Blob([file.content], { type: FORMAT_META[file.format].mime });
  }
}

export async function downloadFile(file: GeneratedFile): Promise<void> {
  const blob = await fileToBlob(file);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
