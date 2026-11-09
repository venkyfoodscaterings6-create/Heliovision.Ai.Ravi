import { describe, expect, it } from "vitest";
import { detectFormat, makeFileName, parseMarkdownTables, slugify, stripMarkdown, toCsv, toHtmlDocument, toJson } from "./formats";

const TABLE = `# Revenue

Some context.

| Channel | Revenue | Share |
| --- | ---: | ---: |
| Retainers | 18400 | 58% |
| Workshops | 4420 | 14% |

| Region | Growth |
| --- | --- |
| North | 12% |`;

describe("format detection", () => {
  it("detects an Excel request", () => {
    expect(detectFormat("Give me this in Excel please")).toBe("xlsx");
    expect(detectFormat("can you export a spreadsheet?")).toBe("xlsx");
    expect(detectFormat("as an xlsx file")).toBe("xlsx");
  });

  it("detects Word, PDF, HTML, CSV, JSON, Markdown and text", () => {
    expect(detectFormat("export this to Word")).toBe("docx");
    expect(detectFormat("give me a PDF of the report")).toBe("pdf");
    expect(detectFormat("turn it into an HTML page")).toBe("html");
    expect(detectFormat("as CSV")).toBe("csv");
    expect(detectFormat("return JSON")).toBe("json");
    expect(detectFormat("give me markdown")).toBe("md");
    expect(detectFormat("as plain text")).toBe("txt");
  });

  it("returns null when no format is requested", () => {
    expect(detectFormat("Help me think through our pricing decision")).toBeNull();
  });

  it("respects enabled formats", () => {
    expect(detectFormat("make an Excel file", ["pdf", "csv"])).toBeNull();
    expect(detectFormat("make a PDF", ["pdf"])).toBe("pdf");
  });
});

describe("table parsing", () => {
  it("extracts one table per sheet with headers and rows", () => {
    const tables = parseMarkdownTables(TABLE);
    expect(tables).toHaveLength(2);
    expect(tables[0].headers).toEqual(["Channel", "Revenue", "Share"]);
    expect(tables[0].rows[0]).toEqual(["Retainers", "18400", "58%"]);
    expect(tables[0].title).toBe("Revenue");
  });
});

describe("file rendering", () => {
  it("escapes CSV cells and keeps numbers readable", () => {
    const csv = toCsv("| Name | Note |\n| --- | --- |\n| Alex | says \"hello\" |");
    expect(csv).toContain('"Alex"');
    expect(csv).toContain('"says ""hello"""');
  });

  it("creates structured JSON with columns from tables", () => {
    const parsed = JSON.parse(toJson(TABLE));
    expect(parsed.tables[0].columns).toContain("Channel");
    expect(parsed.tables[0].rows[0].Channel).toBe("Retainers");
    expect(parsed.tables).toHaveLength(2);
  });

  it("creates a self-contained HTML document", () => {
    const html = toHtmlDocument("# Title\n\nHello", "My title");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<style>");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).not.toContain("<script");
  });
});

describe("file names", () => {
  it("slugifies safely", () => {
    expect(slugify("Weekly revenue — Q3 update!")).toBe("weekly-revenue-q3-update");
    expect(slugify("***")).toBe("heliovision-export");
  });
  it("applies the pattern with date and extension", () => {
    const name = makeFileName("heliovision-{date}-{slug}", "xlsx", "Quarterly revenue review");
    expect(name).toMatch(/^heliovision-\d{4}-\d{2}-\d{2}-quarterly-revenue-review\.xlsx$/);
  });
  it("strips markdown for plain text", () => {
    expect(stripMarkdown("# Hello\n\n**bold** and `code`")).toBe("Hello\n\nbold and code");
  });
});
