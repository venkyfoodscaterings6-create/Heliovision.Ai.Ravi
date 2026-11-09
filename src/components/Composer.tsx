import {
  ArrowUp,
  Camera,
  Check,
  ChevronDown,
  FileSpreadsheet,
  FolderClosed,
  Globe2,
  Lightbulb,
  Loader2,
  Paperclip,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Square,
  Type,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent, type KeyboardEvent } from "react";
import { useWorkspace } from "../store/useWorkspace";
import type { Attachment, FileFormat } from "../lib/types";
import { detectFormat, FORMAT_META } from "../lib/formats";
import { Menu, MenuItem, MenuLabel, MenuSeparator, Tip } from "./ui";
import { uid } from "../lib/seed";
import { modelSupportsSearch } from "../lib/adapters";

export type ResponseStyle = "normal" | "concise" | "explanatory" | "formal";

export interface SendOptions {
  text: string;
  attachments: Attachment[];
  webSearch: boolean;
  thinking: boolean;
  format: FileFormat | null;
  style: ResponseStyle;
  projectId?: string;
}

const STYLE_LABELS: Record<ResponseStyle, { label: string; description: string }> = {
  normal: { label: "Normal", description: "A balanced, thoughtful answer" },
  concise: { label: "Concise", description: "Short, direct and skimmable" },
  explanatory: { label: "Explanatory", description: "More context and worked examples" },
  formal: { label: "Formal", description: "Polished language for professional work" },
};

export function Composer({
  onSend,
  streaming,
  onStop,
  initialText = "",
  promptName,
}: {
  onSend: (options: SendOptions) => void;
  streaming: boolean;
  onStop: () => void;
  initialText?: string;
  promptName?: string;
}) {
  const { models, providers, selectedModelId, selectModel, settings, openSettings, projects, toast } = useWorkspace();
  const [text, setText] = useState(initialText);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [webSearch, setWebSearch] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [formatOverride, setFormatOverride] = useState<FileFormat | "none" | null>(null);
  const [style, setStyle] = useState<ResponseStyle>("normal");
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [picker, setPicker] = useState<"format" | "style" | "project" | null>(null);
  const [dragging, setDragging] = useState(false);
  const [readingFiles, setReadingFiles] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const enabledModels = [...models].sort((a, b) => a.sort - b.sort).filter((model) => model.enabled);
  const selectedModel = models.find((m) => m.id === selectedModelId && m.enabled) ?? enabledModels[0] ?? models.find((m) => m.enabled) ?? models[0];
  const provider = providers.find((p) => p.id === selectedModel?.providerId);
  const grouped = useMemo(() => {
    return providers
      .filter((p) => enabledModels.some((m) => m.providerId === p.id))
      .map((p) => ({ provider: p, models: enabledModels.filter((m) => m.providerId === p.id) }))
      .concat([{ provider: { id: "demo", name: "Demo workspace", type: "openai", baseUrl: "", apiKey: "", keyMasked: "", headers: [], status: "connected", enabled: true, useProxy: false, createdAt: 0 }, models: enabledModels.filter((m) => m.isDemo) }].filter((g) => g.models.length) as any);
  }, [enabledModels, providers]);

  const pinnedProject = projects.find((p) => p.id === projectId);
  const canSearch = Boolean(selectedModel && modelSupportsSearch(selectedModel));
  const canThink = Boolean(selectedModel?.capabilities.reasoning);
  const detected = detectFormat(text, settings.enabledFormats) ?? (settings.defaultFormat !== "none" ? settings.defaultFormat : null);
  const activeFormat: FileFormat | null = formatOverride === "none" ? null : (formatOverride ?? detected);

  useEffect(() => {
    if (initialText) setText(initialText);
  }, [initialText]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 66), 196)}px`;
  }, [text]);

  useEffect(() => {
    if (!canSearch) setWebSearch(false);
    if (!canThink) setThinking(false);
  }, [canSearch, canThink]);

  const readFiles = async (incoming: FileList | File[]) => {
    setReadingFiles(true);
    const files = Array.from(incoming).slice(0, 8);
    const next: Attachment[] = [];
    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) { toast(`${file.name} is over 15 MB`); continue; }
      const base: Attachment = { id: uid("att"), name: file.name, type: file.type || "application/octet-stream", size: file.size };
      try {
        if (file.type.startsWith("image/")) {
          base.dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        } else if (/\.(csv|tsv|txt|md|json|js|jsx|ts|tsx|css|html|xml|yaml|yml|py|sql)$/i.test(file.name) || file.type.startsWith("text/")) {
          base.text = (await file.text()).slice(0, 120_000);
        } else if (/\.(xlsx|xls)$/i.test(file.name)) {
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(await file.arrayBuffer());
          base.text = workbook.SheetNames.map((name) => `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`).join("\n\n").slice(0, 120_000);
        } else {
          base.text = `[Attached ${file.name} — ${(file.size / 1024).toFixed(0)} KB. This file type is stored as an attachment; its binary content is not sent in Demo mode.]`;
        }
        next.push(base);
      } catch {
        toast(`Could not read ${file.name}`);
      }
    }
    setAttachments((current) => [...current, ...next].slice(0, 8));
    setReadingFiles(false);
  };

  const submit = () => {
    if (streaming) return;
    if (!text.trim() && attachments.length === 0) return;
    onSend({ text: text.trim(), attachments, webSearch, thinking, format: activeFormat, style, projectId });
    setText("");
    setAttachments([]);
    setFormatOverride(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length) { event.preventDefault(); void readFiles(files); }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) void readFiles(event.dataTransfer.files);
  };

  const pickFormat = (format: FileFormat | "none") => {
    setFormatOverride(format);
    setPicker(null);
  };

  return (
    <div className="relative w-full" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      {picker && (
        <>
          <div className="fixed inset-0 z-[38]" onClick={() => setPicker(null)} aria-hidden="true" />
          <div className="hv-popover absolute bottom-[calc(100%+8px)] left-0 z-[45] w-[310px] animate-pop p-2">
            <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{picker === "format" ? "Output format" : picker === "style" ? "Response style" : "Use a project"}</span>
              <button onClick={() => setPicker(null)} className="hv-icon-btn !size-6"><X size={12} /></button>
            </div>
            {picker === "format" && (
              <div className="max-h-[320px] overflow-y-auto">
                <button onClick={() => pickFormat("none")} className="hv-menu-item"><Type size={14} /><span className="flex-1">Normal chat reply</span>{formatOverride === "none" && <Check size={13} />}</button>
                {(["xlsx", "csv", "docx", "pdf", "html", "md", "json", "txt"] as FileFormat[]).filter((f) => settings.enabledFormats.includes(f)).map((format) => (
                  <button key={format} onClick={() => pickFormat(format)} className="hv-menu-item">
                    <FileSpreadsheet size={14} />
                    <span className="flex-1"><span className="block">{FORMAT_META[format].label}</span><span className="block text-[10.5px] text-[var(--text-muted)]">{FORMAT_META[format].description}</span></span>
                    {activeFormat === format && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
            {picker === "style" && Object.entries(STYLE_LABELS).map(([value, meta]) => (
              <button key={value} onClick={() => { setStyle(value as ResponseStyle); setPicker(null); }} className="hv-menu-item">
                <Sparkles size={14} /><span className="flex-1"><span className="block">{meta.label}</span><span className="block text-[10.5px] text-[var(--text-muted)]">{meta.description}</span></span>
                {style === value && <Check size={13} />}
              </button>
            ))}
            {picker === "project" && (
              <div className="max-h-[300px] overflow-y-auto">
                <button onClick={() => { setProjectId(undefined); setPicker(null); }} className="hv-menu-item"><FolderClosed size={14} /><span className="flex-1">No project</span>{!projectId && <Check size={13} />}</button>
                {projects.map((project) => (
                  <button key={project.id} onClick={() => { setProjectId(project.id); setPicker(null); }} className="hv-menu-item">
                    <span className="size-2 rounded-full" style={{ background: project.color }} /><span className="flex-1">{project.name}</span>{projectId === project.id && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className={`relative rounded-[22px] border bg-[var(--surface)] shadow-[0_2px_6px_rgba(31,30,29,.035),0_8px_28px_rgba(31,30,29,.04)] transition-[border-color,box-shadow] duration-200 ${dragging ? "border-[var(--accent)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_15%,transparent)]" : "border-[var(--border)] focus-within:border-[color-mix(in_srgb,var(--text-muted)_45%,var(--border))] focus-within:shadow-[0_3px_8px_rgba(31,30,29,.04),0_10px_34px_rgba(31,30,29,.055)]"}`}>
        {dragging && <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[22px] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] text-[12px] font-medium text-[var(--accent-text)]"><Paperclip size={16} className="mr-2" /> Drop files to attach</div>}
        {(attachments.length > 0 || activeFormat || pinnedProject) && (
          <div className="flex flex-wrap gap-1.5 px-3 pb-0.5 pt-3 sm:px-4">
            {attachments.map((attachment) => (
              <span key={attachment.id} className="flex max-w-[230px] items-center gap-1.5 rounded-md border border-[var(--border-soft)] bg-[var(--code-bg)] py-1 pl-2 pr-1 text-[11px]">
                {attachment.type.startsWith("image/") && attachment.dataUrl ? <img src={attachment.dataUrl} alt="" className="size-5 rounded object-cover" /> : <Paperclip size={11} className="text-[var(--text-muted)]" />}
                <span className="truncate">{attachment.name}</span>
                <button onClick={() => setAttachments((items) => items.filter((a) => a.id !== attachment.id))} className="flex size-4 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]" aria-label={`Remove ${attachment.name}`}><X size={10} /></button>
              </span>
            ))}
            {activeFormat && (
              <span className="flex items-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[var(--accent-soft)] py-1 pl-2 pr-1 text-[11px] text-[var(--accent-text)]">
                <FileSpreadsheet size={11} /> Output: {FORMAT_META[activeFormat].label}
                <button onClick={() => setFormatOverride("none")} className="flex size-4 items-center justify-center rounded hover:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]" aria-label="Remove output format"><X size={10} /></button>
              </span>
            )}
            {pinnedProject && (
              <span className="flex items-center gap-1.5 rounded-md border border-[var(--border-soft)] bg-[var(--code-bg)] py-1 pl-2 pr-1 text-[11px]">
                <FolderClosed size={11} style={{ color: pinnedProject.color }} /> {pinnedProject.name}
                <button onClick={() => setProjectId(undefined)} className="flex size-4 items-center justify-center rounded hover:bg-[var(--surface-hover)]" aria-label="Remove project"><X size={10} /></button>
              </span>
            )}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          rows={1}
          placeholder="How can I help you today?"
          aria-label="Message HelioVision.Ai"
          className="block max-h-[196px] min-h-[66px] w-full resize-none overflow-y-auto bg-transparent px-4 pb-2 pt-4 text-[15.5px] leading-[1.6] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] sm:px-[18px] sm:pt-[18px]"
        />
        <div className="flex items-end gap-1.5 px-2 pb-2 pt-1 sm:px-2.5">
          <Menu
            side="top"
            align="start"
            contentClassName="w-[250px] mb-1"
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted-strong)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
            trigger={<Plus size={17} strokeWidth={1.6} />}
          >
            <MenuItem icon={<Paperclip size={15} />} onSelect={() => fileRef.current?.click()}>Upload files</MenuItem>
            <MenuItem icon={<Camera size={15} />} onSelect={() => cameraRef.current?.click()}>Add from camera</MenuItem>
            <MenuItem icon={<FolderClosed size={15} />} onSelect={() => setPicker(picker === "project" ? null : "project")}>{pinnedProject ? pinnedProject.name : "Use a project"}</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Globe2 size={15} />} disabled={!canSearch} onSelect={() => setWebSearch(!webSearch)}>
              Web search <span className="ml-auto">{canSearch ? (webSearch ? <Check size={13} /> : "Off") : <span className="text-[10px]">Not supported</span>}</span>
            </MenuItem>
            <MenuItem icon={<Lightbulb size={15} />} disabled={!canThink} onSelect={() => setThinking(!thinking)}>
              Extended thinking <span className="ml-auto">{canThink ? (thinking ? <Check size={13} /> : "Off") : <span className="text-[10px]">Not supported</span>}</span>
            </MenuItem>
            <MenuItem icon={<FileSpreadsheet size={15} />} onSelect={() => setPicker(picker === "format" ? null : "format")}>Output format <span className="ml-auto text-[10px]">{activeFormat ? FORMAT_META[activeFormat].label : "None"}</span></MenuItem>
            <MenuItem icon={<SlidersHorizontal size={15} />} onSelect={() => setPicker(picker === "style" ? null : "style")}>Response style <span className="ml-auto text-[10px]">{STYLE_LABELS[style].label}</span></MenuItem>
          </Menu>
          <input ref={fileRef} type="file" multiple hidden accept=".txt,.md,.json,.csv,.tsv,.pdf,.xlsx,.xls,.doc,.docx,.html,.css,.js,.jsx,.ts,.tsx,.py,.sql,image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) void readFiles(e.target.files); e.target.value = ""; }} />
          <input ref={cameraRef} type="file" hidden accept="image/*" capture="environment" onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) void readFiles(e.target.files); e.target.value = ""; }} />

          {(webSearch || thinking) && (
            <div className="hidden items-center gap-1 sm:flex">
              {webSearch && <span className="hv-badge !bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] !text-[var(--accent-text)]"><Globe2 size={11} /> Search</span>}
              {thinking && <span className="hv-badge !bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] !text-[var(--accent-text)]"><Lightbulb size={11} /> Thinking</span>}
            </div>
          )}
          {readingFiles && <span className="flex items-center gap-1 text-[10.5px] text-[var(--text-muted)]"><Loader2 size={11} className="animate-spin" /> Reading…</span>}

          <div className="ml-auto flex min-w-0 items-center gap-1.5">
            <Menu
              side="top"
              align="end"
              contentClassName="w-[330px] mb-1 max-h-[430px] overflow-y-auto"
              className="flex h-8 min-w-0 max-w-[205px] items-center gap-1 rounded-md px-2 text-[12px] font-[450] text-[var(--text-muted-strong)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
              trigger={<><span className="truncate max-[420px]:max-w-[68px]">{selectedModel?.name ?? "Model"}</span><ChevronDown size={12} strokeWidth={1.6} className="shrink-0 opacity-70" /></>}
            >
              <div className="flex items-center justify-between px-2.5 pb-1 pt-1.5">
                <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)]">Choose a model</span>
                {provider && <span className="text-[9.5px] text-[var(--text-muted)]">{provider.type}</span>}
              </div>
              {grouped.map((group: any) => (
                <div key={group.provider.id}>
                  <MenuLabel>{group.provider.name}</MenuLabel>
                  {group.models.map((model: any) => (
                    <button key={model.id} onClick={() => selectModel(model.id)} className="hv-menu-item !items-start">
                      <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ${model.isDemo ? "bg-[var(--accent-soft)] text-[var(--accent-text)]" : "bg-[var(--code-bg)] text-[var(--text-muted-strong)]"}`}>
                        {model.isDemo ? <Sparkles size={12} strokeWidth={1.5} /> : <span className="text-[9px] font-medium">{model.name.slice(0, 2)}</span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-[12.5px] font-[450]">{model.name}{model.isDefault && <span className="rounded bg-[var(--code-bg)] px-1 py-px text-[8.5px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Default</span>}</span>
                        <span className="mt-0.5 block text-[10.5px] leading-snug text-[var(--text-muted)]">{model.description}</span>
                        <span className="mt-1 flex gap-1.5 text-[8.5px] uppercase tracking-wide text-[var(--text-muted)]">
                          {model.capabilities.vision && <span>Vision</span>}{model.capabilities.reasoning && <span>Reasoning</span>}{model.capabilities.files && <span>Files</span>}
                        </span>
                      </span>
                      {model.id === selectedModel?.id && <Check size={13} className="mt-1 shrink-0 text-[var(--accent-text)]" />}
                    </button>
                  ))}
                </div>
              ))}
              {enabledModels.length === 0 && <div className="px-3 py-6 text-center text-[12px] text-[var(--text-muted)]">No models enabled yet.<br />Add one in provider settings.</div>}
              <MenuSeparator />
              <MenuItem icon={<Plus size={14} />} onSelect={() => openSettings("models")}>More models</MenuItem>
              <MenuItem icon={<SlidersHorizontal size={14} />} onSelect={() => openSettings("models")}>Provider settings</MenuItem>
            </Menu>
            {streaming ? (
              <Tip label="Stop generating">
                <button onClick={onStop} className="stop-btn flex size-8 items-center justify-center rounded-full transition-transform hover:scale-[1.04]" aria-label="Stop generating"><Square size={11} fill="currentColor" strokeWidth={1.5} /></button>
              </Tip>
            ) : (
              <button
                onClick={submit}
                disabled={(!text.trim() && !attachments.length) || !selectedModel}
                className="send-btn flex size-8 items-center justify-center rounded-full shadow-[0_1px_2px_rgba(31,30,29,.12)] transition-all duration-150 disabled:opacity-65"
                aria-label="Send message"
              >
                <ArrowUp size={17} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>
      {promptName && <span className="pointer-events-none absolute -top-6 left-1 text-[10.5px] text-[var(--text-muted)]">{promptName}</span>}
    </div>
  );
}
