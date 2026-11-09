import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  FileJson,
  FileOutput,
  FileText,
  Info,
  Keyboard,
  Languages,
  Laptop,
  LockKeyhole,
  Moon,
  Palette,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
  X,
  Cpu,
} from "lucide-react";
import { useRef, useState } from "react";
import { useWorkspace } from "../store/useWorkspace";
import { ProviderSettings } from "./ProviderSettings";
import { Avatar, Modal, SunMark, Switch } from "./ui";
import type { FileFormat, Theme } from "../lib/types";
import { FORMAT_META, makeFileName } from "../lib/formats";
import { sealKeyVault } from "../lib/keyVault";

const TABS = [
  { id: "general", label: "General", icon: UserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "models", label: "Models & providers", icon: Cpu },
  { id: "formats", label: "Output formats", icon: FileOutput },
  { id: "data", label: "Data & privacy", icon: ShieldCheck },
  { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard },
  { id: "about", label: "About", icon: Info },
];

function SectionHeader({ title, description }: { title: string; description: string }) {
  return <div className="mb-6"><h2 className="text-[17px] font-[500] tracking-[-0.01em]">{title}</h2><p className="mt-1 max-w-[560px] text-[11.5px] leading-relaxed text-[var(--text-muted)]">{description}</p></div>;
}

function SettingRow({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 border-b border-[var(--border-soft)] py-4 last:border-0 sm:flex-row sm:items-center sm:gap-5"><div className="min-w-0 flex-1"><div className="text-[12.5px] font-[450]">{title}</div>{description && <p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--text-muted)]">{description}</p>}</div><div className="shrink-0">{children}</div></div>;
}

function ThemePreview({ theme }: { theme: Theme }) {
  const dark = theme === "dark";
  return (
    <div className={`relative h-[84px] overflow-hidden rounded-[8px] border ${theme === "system" ? "border-[var(--border)]" : "border-transparent"}`}>
      {theme === "system" ? (
        <div className="flex h-full"><div className="w-1/2 bg-[#FAF9F5] p-2.5"><div className="mb-1.5 h-1 w-7 rounded bg-[#D97757]" /><div className="h-1 w-9 rounded bg-[#d9d6ca]" /><div className="mt-3 h-4 rounded bg-white" /></div><div className="w-1/2 bg-[#1F1E1D] p-2.5"><div className="mb-1.5 h-1 w-7 rounded bg-[#D97757]" /><div className="h-1 w-9 rounded bg-[#4a4843]" /><div className="mt-3 h-4 rounded bg-[#30302E]" /></div></div>
      ) : (
        <div className={`flex h-full ${dark ? "bg-[#1F1E1D]" : "bg-[#FAF9F5]"}`}>
          <div className={`w-[28%] p-2 ${dark ? "bg-[#181716]" : "bg-[#F0EEE6]"}`}><div className="h-1 w-4 rounded bg-[#D97757]" /><div className={`mt-2 h-1 w-7 rounded ${dark ? "bg-[#4a4843]" : "bg-[#d5d1c4]"}`} /><div className={`mt-1.5 h-1 w-6 rounded ${dark ? "bg-[#3a3a37]" : "bg-[#e1ded3]"}`} /></div>
          <div className="flex-1 p-2.5"><div className={`h-1.5 w-10 rounded ${dark ? "bg-[#5a5851]" : "bg-[#a9a69b]"}`} /><div className={`mt-2 h-[22px] rounded border ${dark ? "border-[#4a4843] bg-[#30302E]" : "border-[#e2dfd4] bg-white"}`} /><div className={`mx-auto mt-2 size-3.5 rounded-full bg-[#D97757]`} /></div>
        </div>
      )}
    </div>
  );
}

export function SettingsModal() {
  const {
    settingsOpen, settingsTab, closeSettings, settings, updateSettings, setTheme, openSettings,
    chats, messages, projects, files, providers, models, importWorkspace, resetWorkspace,
    deleteChat, toast, lockWorkspace,
  } = useWorkspace();
  const [includeKeys, setIncludeKeys] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [passOpen, setPassOpen] = useState(false);
  const [pass, setPass] = useState("");
  const [passConfirm, setPassConfirm] = useState("");
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  if (!settingsOpen) return null;

  const exportAll = () => {
    const payload = {
      brand: "HelioVision.Ai",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      includeKeys,
      data: {
        chats, messages, projects, files, models,
        providers: providers.map((p) => includeKeys ? p : { ...p, apiKey: "" }),
        settings,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `heliovision-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast(includeKeys ? "Workspace exported with keys" : "Workspace exported (keys excluded)");
  };

  const importAll = async (file: File) => {
    setImporting(true);
    try {
      const parsed = JSON.parse(await file.text());
      const data = parsed.data ?? parsed;
      if (!data || (!Array.isArray(data.chats) && !Array.isArray(data.providers))) throw new Error("Invalid file");
      importWorkspace(data);
      toast("Workspace imported");
    } catch {
      toast("That file is not a valid HelioVision export");
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  const formatInstruction = makeFileName(settings.fileNamePattern || "heliovision-{date}-{slug}", "xlsx", "quarterly revenue review");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-5" role="dialog" aria-modal="true" aria-label="Settings">
      <button className="absolute inset-0 bg-[rgba(20,20,19,.4)] backdrop-blur-[2px]" onClick={closeSettings} aria-label="Close settings" />
      <div className="animate-slide-up relative flex h-full w-full flex-col overflow-hidden border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] sm:h-[min(86vh,700px)] sm:max-w-[930px] sm:rounded-[18px]">
        <div className="flex h-[56px] shrink-0 items-center gap-3 border-b border-[var(--border-soft)] px-4 sm:px-5">
          <span className="text-[var(--accent)]"><SunMark size={19} /></span>
          <h1 className="text-[14px] font-[500]">Settings</h1>
          <span className="hv-badge !h-5 !text-[9px]">Local workspace</span>
          <button onClick={closeSettings} className="hv-icon-btn ml-auto -mr-1" aria-label="Close settings panel"><X size={17} strokeWidth={1.5} /></button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--border-soft)] bg-[var(--bg-sidebar)] p-2 sm:w-[210px] sm:flex-col sm:border-b-0 sm:border-r sm:p-3" aria-label="Settings sections">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => openSettings(id)} className={`flex shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-left text-[11.5px] transition-colors sm:w-full ${settingsTab === id ? "bg-[var(--surface)] font-[450] text-[var(--text)] shadow-sm" : "text-[var(--text-muted-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"}`}>
                <Icon size={14} strokeWidth={1.5} className={settingsTab === id ? "text-[var(--accent-text)]" : ""} /><span className="whitespace-nowrap">{label}</span>{settingsTab === id && <ChevronRight size={12} className="ml-auto hidden sm:block" />}
              </button>
            ))}
            <div className="mt-auto hidden px-2 pt-4 sm:block"><div className="flex items-center gap-2 rounded-md border border-[var(--border-soft)] bg-[var(--surface)] px-2 py-1.5"><span className="size-[5px] rounded-full bg-[var(--success)]" /><span className="text-[9.5px] text-[var(--text-muted)]">Saved in this browser</span></div></div>
          </nav>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {settingsTab === "models" ? <ProviderSettings /> : (
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-5 sm:px-7">
                {settingsTab === "general" && (
                  <div className="max-w-[590px]">
                    <SectionHeader title="General" description="A few small details that make HelioVision feel like yours. Changes save automatically." />
                    <div className="flex items-center gap-3 rounded-[12px] border border-[var(--border-soft)] bg-[var(--code-bg)] p-3.5">
                      <Avatar name={settings.name} size={42} />
                      <div><div className="text-[12.5px] font-[450]">{settings.name || "Your workspace"}</div><div className="text-[10.5px] text-[var(--text-muted)]">{settings.plan || "Personal workspace"} · no account required</div></div>
                      <span className="hv-badge ml-auto hidden !bg-[var(--surface)] sm:flex"><Sparkles size={10} /> Local profile</span>
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div><label className="hv-label" htmlFor="settings-name">Display name</label><input id="settings-name" value={settings.name} onChange={(e) => updateSettings({ name: e.target.value })} placeholder="Your name" className="hv-input" /><p className="mt-1 text-[10px] text-[var(--text-muted)]">Used only in the greeting and profile.</p></div>
                      <div><label className="hv-label" htmlFor="settings-plan">Plan label</label><input id="settings-plan" value={settings.plan} onChange={(e) => updateSettings({ plan: e.target.value })} placeholder="e.g. Studio plan" className="hv-input" /><p className="mt-1 text-[10px] text-[var(--text-muted)]">A local label, not a subscription.</p></div>
                    </div>
                    <div className="mt-5">
                      <SettingRow title="Language" description="Language selection is local. English is the default."><div className="relative"><Languages size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><select value={settings.language} onChange={(e) => updateSettings({ language: e.target.value })} className="hv-input !h-8 min-w-[150px] appearance-none pl-8 pr-7 text-[11.5px]" aria-label="Language"><option>English</option></select><ChevronRight size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-[var(--text-muted)]" /></div></SettingRow>
                      <SettingRow title="Theme" description="System follows your device appearance live."><div className="flex gap-1 rounded-md border border-[var(--border-soft)] p-0.5">{(["light", "dark", "system"] as Theme[]).map((theme) => <button key={theme} onClick={() => setTheme(theme)} className={`flex items-center gap-1.5 rounded px-2 py-1 text-[10.5px] capitalize ${settings.theme === theme ? "bg-[var(--surface-hover)] font-medium text-[var(--text)]" : "text-[var(--text-muted)]"}`}>{theme === "light" ? <Sun size={11} /> : theme === "dark" ? <Moon size={11} /> : <Laptop size={11} />}{theme}</button>)}</div></SettingRow>
                      <SettingRow title="Text size" description="Adjusts the interface density and message size."><div className="flex rounded-md border border-[var(--border-soft)] p-0.5">{(["compact", "default", "large"] as const).map((size) => <button key={size} onClick={() => updateSettings({ fontSize: size })} className={`rounded px-2.5 py-1 text-[10.5px] capitalize ${settings.fontSize === size ? "bg-[var(--surface-hover)] font-medium text-[var(--text)]" : "text-[var(--text-muted)]"}`}>{size}</button>)}</div></SettingRow>
                    </div>
                    <p className="mt-4 font-serif text-[14px] italic text-[var(--text-muted-strong)]">“Clarity is a form of care.”</p>
                  </div>
                )}

                {settingsTab === "appearance" && (
                  <div>
                    <SectionHeader title="Appearance" description="Warm, quiet and legible. Choose how your workspace feels, not just how it looks." />
                    <span className="hv-label">Theme</span>
                    <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {(["light", "dark", "system"] as Theme[]).map((theme) => (
                        <button key={theme} onClick={() => setTheme(theme)} className={`rounded-[11px] border p-1.5 text-left transition-all ${settings.theme === theme ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]" : "border-[var(--border-soft)] hover:border-[var(--border)]"}`}>
                          <ThemePreview theme={theme} />
                          <div className="flex items-center gap-1.5 px-1 pb-0.5 pt-2 text-[11.5px] font-[450] capitalize">{theme === "light" ? <Sun size={12} /> : theme === "dark" ? <Moon size={12} /> : <Laptop size={12} />}{theme}{settings.theme === theme && <span className="ml-auto flex size-3.5 items-center justify-center rounded-full bg-[var(--accent)] text-white"><Check size={9} /></span>}</div>
                        </button>
                      ))}
                    </div>
                    <div className="mt-6 border-t border-[var(--border-soft)] pt-5">
                      <span className="hv-label">Chat font</span>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {([
                          ["default", "Default", "Source Serif for replies, Inter throughout", "font-serif"],
                          ["sans", "Sans", "Inter for everything — direct and modern", "font-sans"],
                          ["serif", "Serif", "Source Serif — a longer-reading feel", "font-serif italic"],
                          ["dyslexic", "Dyslexia-friendly", "Lexend, with generous letter spacing", "font-sans"],
                        ] as const).map(([id, label, desc, cls]) => (
                          <button key={id} onClick={() => updateSettings({ chatFont: id })} className={`rounded-[10px] border p-3 text-left ${settings.chatFont === id ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_4%,transparent)]" : "border-[var(--border-soft)] hover:border-[var(--border)]"}`}>
                            <div className="flex items-center justify-between"><span className="text-[11.5px] font-[450]">{label}</span>{settings.chatFont === id && <Check size={12} className="text-[var(--accent-text)]" />}</div>
                            <p className={`mt-1.5 text-[14px] leading-snug text-[var(--text-muted-strong)] ${cls}`} style={id === "dyslexic" ? { fontFamily: "Lexend, Inter, sans-serif", letterSpacing: ".01em" } : undefined}>The quiet hours make room for better thinking.</p>
                            <p className="mt-1.5 text-[9.5px] text-[var(--text-muted)]">{desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-6 border-t border-[var(--border-soft)] pt-2">
                      <SettingRow title="Text size" description="Interface and reading text scale together."><div className="flex rounded-md border border-[var(--border-soft)] p-0.5">{(["compact", "default", "large"] as const).map((size) => <button key={size} onClick={() => updateSettings({ fontSize: size })} className={`rounded px-2.5 py-1 text-[10.5px] capitalize ${settings.fontSize === size ? "bg-[var(--surface-hover)] text-[var(--text)]" : "text-[var(--text-muted)]"}`}>{size}</button>)}</div></SettingRow>
                      <SettingRow title="Reduced motion" description="Automatically respected through your system settings."><span className="hv-badge"><span className="size-[5px] rounded-full bg-[var(--success)]" /> System</span></SettingRow>
                    </div>
                  </div>
                )}

                {settingsTab === "formats" && (
                  <div>
                    <SectionHeader title="Output formats" description="When a message asks for a file, HelioVision quietly generates it in your browser. Choose which formats you want available." />
                    <div className="overflow-hidden rounded-[12px] border border-[var(--border-soft)]">
                      {(Object.keys(FORMAT_META) as FileFormat[]).map((format, index) => {
                        const enabled = settings.enabledFormats.includes(format);
                        return (
                          <div key={format} className={`flex items-center gap-3 px-3.5 py-3 ${index > 0 ? "border-t border-[var(--border-soft)]" : ""}`}>
                            <span className="flex size-8 items-center justify-center rounded-md bg-[var(--code-bg)] text-[var(--text-muted-strong)]"><FileText size={15} strokeWidth={1.5} /></span>
                            <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 text-[12px] font-[450]">{FORMAT_META[format].label}<span className="rounded bg-[var(--code-bg)] px-1 py-px font-mono text-[8.5px] uppercase text-[var(--text-muted)]">.{FORMAT_META[format].extension}</span></div><p className="text-[10px] text-[var(--text-muted)]">{FORMAT_META[format].description}</p></div>
                            <Switch checked={enabled} onChange={(value) => updateSettings({ enabledFormats: value ? [...settings.enabledFormats, format] : settings.enabledFormats.filter((f) => f !== format) })} label={`Enable ${FORMAT_META[format].label}`} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-5 rounded-[12px] border border-[var(--border-soft)] bg-[var(--code-bg)] p-3.5">
                      <label className="hv-label" htmlFor="file-pattern">File-name pattern</label>
                      <input id="file-pattern" value={settings.fileNamePattern} onChange={(e) => updateSettings({ fileNamePattern: e.target.value })} className="hv-input font-mono text-[11px]" />
                      <div className="mt-2 flex flex-wrap gap-1.5">{[["{date}", "2026-03-14"], ["{slug}", "your-topic"], ["{format}", "xlsx"]].map(([token, example]) => <span key={token} className="hv-badge !h-5 !text-[9px]"><code className="text-[var(--accent-text)]">{token}</code><span className="text-[var(--text-muted)]">{example}</span></span>)}</div>
                      <p className="mt-2 text-[10px] text-[var(--text-muted)]">Preview: <span className="font-mono text-[var(--text-muted-strong)]">{formatInstruction}</span></p>
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-[12px] border border-[var(--border-soft)] px-3.5 py-3"><div><div className="text-[12px] font-[450]">Default output</div><p className="text-[10.5px] text-[var(--text-muted)]">Used when a message does not mention a format.</p></div><select value={settings.defaultFormat} onChange={(e) => updateSettings({ defaultFormat: e.target.value as FileFormat | "none" })} className="hv-input !h-8 w-[140px] text-[11.5px]" aria-label="Default output"><option value="none">Normal chat reply</option>{settings.enabledFormats.map((f) => <option key={f} value={f}>{FORMAT_META[f].label}</option>)}</select></div>
                    <p className="mt-3 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]"><span className="size-[5px] rounded-full bg-[var(--success)]" /> Detected formats appear as a removable chip above the composer.</p>
                  </div>
                )}

                {settingsTab === "data" && (
                  <div>
                    <SectionHeader title="Data & privacy" description="No account, no analytics, no telemetry. Everything lives in this browser unless you export it." />
                    <div className="grid grid-cols-3 gap-2">
                      {[["Conversations", chats.length], ["Messages", messages.length], ["Generated files", files.length]].map(([label, value]) => <div key={label as string} className="rounded-[10px] border border-[var(--border-soft)] bg-[var(--code-bg)] p-3"><div className="text-[19px] font-[400] tracking-tight">{value}</div><div className="mt-0.5 text-[9.5px] text-[var(--text-muted)]">{label}</div></div>)}
                    </div>
                    <div className="mt-6 space-y-2.5">
                      <div className="rounded-[12px] border border-[var(--border-soft)] p-3.5">
                        <div className="flex items-center gap-2.5"><span className="flex size-8 items-center justify-center rounded-md bg-[var(--code-bg)] text-[var(--text-muted-strong)]"><ArrowDownToLine size={15} /></span><div className="flex-1"><div className="text-[12px] font-[450]">Export your workspace</div><p className="text-[10.5px] text-[var(--text-muted)]">One JSON file with chats, messages, projects, files, models and settings.</p></div><button onClick={exportAll} className="hv-btn hv-btn-secondary !h-8 text-[11px]"><Download size={12} /> Export all</button></div>
                        <label className="mt-3 flex items-center gap-2 pl-10 text-[10.5px] text-[var(--text-muted-strong)]"><input type="checkbox" checked={includeKeys} onChange={(e) => setIncludeKeys(e.target.checked)} className="accent-[var(--accent)]" /> Include API keys in the export (visible plain text)</label>
                      </div>
                      <div className="flex items-center gap-2.5 rounded-[12px] border border-[var(--border-soft)] p-3.5"><span className="flex size-8 items-center justify-center rounded-md bg-[var(--code-bg)] text-[var(--text-muted-strong)]"><ArrowUpFromLine size={15} /></span><div className="flex-1"><div className="text-[12px] font-[450]">Import a workspace</div><p className="text-[10.5px] text-[var(--text-muted)]">Merge a HelioVision JSON export. Keys are imported only if present.</p></div><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importAll(f); }} /><button onClick={() => importRef.current?.click()} disabled={importing} className="hv-btn hv-btn-secondary !h-8 text-[11px]">{importing ? <RefreshCw size={12} className="animate-spin" /> : <ArrowUpFromLine size={12} />} Import</button></div>
                      <div className="flex items-center gap-2.5 rounded-[12px] border border-[var(--border-soft)] p-3.5"><span className="flex size-8 items-center justify-center rounded-md bg-[var(--code-bg)] text-[var(--text-muted-strong)]"><LockKeyhole size={15} /></span><div className="flex-1"><div className="text-[12px] font-[450]">Protect saved keys</div><p className="text-[10.5px] text-[var(--text-muted)]">{settings.keysLocked ? "Passphrase protection is on. Your workspace locks when you step away." : "Add an extra local passphrase for an idle workspace lock."}</p></div><button onClick={() => setPassOpen(true)} className="hv-btn hv-btn-secondary !h-8 text-[11px]">{settings.keysLocked ? "Change" : "Set passphrase"}</button></div>
                    </div>
                    <div className="mt-7 rounded-[12px] border border-[color-mix(in_srgb,var(--danger)_26%,transparent)] p-4">
                      <div className="flex items-center gap-2 text-[12px] font-[450] text-[var(--danger)]"><Trash2 size={14} /> Danger zone</div>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2"><span className="flex-1 text-[11px] text-[var(--text-muted-strong)]">Delete all conversations and messages</span><button onClick={() => { chats.forEach((chat) => deleteChat(chat.id)); toast("All chats deleted"); }} disabled={!chats.length} className="hv-btn hv-btn-danger !h-7 text-[10.5px]">Delete chats</button></div>
                        <div className="flex items-center gap-2"><span className="flex-1 text-[11px] text-[var(--text-muted-strong)]">Remove every saved API key</span><button onClick={() => { providers.forEach((p) => useWorkspace.getState().updateProvider(p.id, { apiKey: "", keyMasked: "Not set", status: "untested" })); toast("All API keys removed"); }} disabled={!providers.some((p) => p.apiKey)} className="hv-btn hv-btn-danger !h-7 text-[10.5px]">Remove keys</button></div>
                        <div className="flex items-center gap-2"><span className="flex-1 text-[11px] text-[var(--text-muted-strong)]">Lock this workspace now</span><button onClick={() => { closeSettings(); lockWorkspace(); toast("Workspace locked"); }} className="hv-btn hv-btn-danger !h-7 text-[10.5px]">Lock</button></div>
                        <div className="flex items-center gap-2"><span className="flex-1 text-[11px] text-[var(--text-muted-strong)]">Reset this workspace to a clean demo</span><button onClick={() => setConfirmWipe(true)} className="hv-btn hv-btn-danger !h-7 text-[10.5px]">Reset</button></div>
                      </div>
                    </div>
                    <p className="mt-4 flex items-start gap-1.5 text-[10px] leading-relaxed text-[var(--text-muted)]"><ShieldCheck size={12} className="mt-px shrink-0" /> Your API keys are sent only to the provider's base URL or your own proxy. HelioVision has no backend storage.</p>
                  </div>
                )}

                {settingsTab === "shortcuts" && (
                  <div>
                    <SectionHeader title="Keyboard shortcuts" description="Move quickly without leaving the keyboard. On Windows and Linux, use Ctrl in place of ⌘." />
                    <div className="overflow-hidden rounded-[12px] border border-[var(--border-soft)]">
                      {[
                        ["New conversation", "⌘ Shift O"], ["Toggle sidebar", "⌘ B"], ["Command palette", "⌘ K"], ["Show this shortcut list", "⌘ /"], ["Send message", "Enter"], ["New line in message", "Shift Enter"], ["Close any menu or dialog", "Esc"], ["Focus message input", "/"], ["Copy current response", "⌘ C"],
                      ].map(([label, keys], index) => <div key={label} className={`flex items-center justify-between px-3.5 py-3 text-[12px] ${index > 0 ? "border-t border-[var(--border-soft)]" : ""}`}><span className="text-[var(--text-muted-strong)]">{label}</span><span className="flex gap-1">{keys.split(" ").map((key) => <kbd key={key} className="min-w-[24px] rounded-[5px] border border-[var(--border)] bg-[var(--code-bg)] px-1.5 py-0.5 text-center font-sans text-[10px] text-[var(--text-muted-strong)] shadow-[0_1px_0_var(--border)]">{key}</kbd>)}</span></div>)}
                    </div>
                    <div className="mt-4 flex gap-2.5 rounded-lg border border-[var(--border-soft)] bg-[var(--code-bg)] p-3"><Keyboard size={15} className="shrink-0 text-[var(--text-muted)]" /><p className="text-[10.5px] leading-relaxed text-[var(--text-muted-strong)]">Shortcuts are disabled while you are typing in a text field, except for Send, New line and the global palette shortcut.</p></div>
                  </div>
                )}

                {settingsTab === "about" && (
                  <div>
                    <SectionHeader title="About HelioVision.Ai" description="A quiet, multi-provider workspace built on a simple belief: your thinking should stay yours." />
                    <div className="rounded-[14px] border border-[var(--border-soft)] bg-[var(--code-bg)] p-5">
                      <div className="flex items-center gap-3"><span className="text-[var(--accent)]"><SunMark size={30} /></span><div><div className="font-serif text-[22px] leading-none">HelioVision<span className="text-[var(--accent-text)]">.Ai</span></div><div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Your private thinking space</div></div></div>
                      <p className="mt-4 max-w-[470px] font-serif text-[14px] leading-[1.7] text-[var(--text-muted-strong)]">HelioVision.Ai brings your own models into one calm place. No accounts. No telemetry. No intermediary between your keys and your provider.</p>
                    </div>
                    <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                      {[
                        [ShieldCheck, "Local-first by default", "Chats, providers and files are stored in this browser."],
                        [FileJson, "Your data is portable", "Export everything as a single JSON file at any time."],
                        [Cpu, "Multi-provider", "OpenAI-compatible, Anthropic and Gemini adapters built in."],
                        [CircleHelp, "No lock-in", "No model IDs are hard-coded. Add exactly what you need."],
                      ].map(([Icon, title, text]: any) => <div key={title} className="rounded-[10px] border border-[var(--border-soft)] p-3"><Icon size={15} className="text-[var(--accent-text)]" /><div className="mt-2 text-[11.5px] font-[450]">{title}</div><p className="mt-0.5 text-[10px] leading-relaxed text-[var(--text-muted)]">{text}</p></div>)}
                    </div>
                    <div className="mt-5 space-y-2 border-t border-[var(--border-soft)] pt-4 text-[11px]">
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Version</span><span>1.0.0 · local build</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Storage</span><span>{providers.length} providers · {chats.length} chats · {files.length} files</span></div>
                      <div className="flex justify-between"><span className="text-[var(--text-muted)]">Brand</span><span>HelioVision.Ai</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={passOpen} onClose={() => setPassOpen(false)} title="Protect your workspace" description="Use a local passphrase to lock this workspace when you step away." width="440px">
        <form onSubmit={async (e) => { e.preventDefault(); if (pass.length < 6 || pass !== passConfirm) { toast("Passphrases must match and be at least 6 characters"); return; } const sealed = await sealKeyVault(pass, providers); if (!sealed) { toast("This browser could not create a local vault."); return; } updateSettings({ keysLocked: true }); setPass(""); setPassConfirm(""); setPassOpen(false); toast("Passphrase set — saved keys encrypted locally"); }} className="p-5">
          <label className="hv-label" htmlFor="pass-one">Passphrase</label><input id="pass-one" type="password" value={pass} onChange={(e) => setPass(e.target.value)} className="hv-input" autoFocus placeholder="At least 6 characters" />
          <div className="mt-3"><label className="hv-label" htmlFor="pass-two">Confirm passphrase</label><input id="pass-two" type="password" value={passConfirm} onChange={(e) => setPassConfirm(e.target.value)} className="hv-input" placeholder="Repeat it once" /></div>
          <p className="mt-2 text-[10px] text-[var(--text-muted)]">The passphrase is never sent anywhere. If you lose it, exported keys cannot be recovered.</p>
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setPassOpen(false)} className="hv-btn hv-btn-secondary">Cancel</button><button className="hv-btn hv-btn-primary">Set passphrase</button></div>
        </form>
      </Modal>
      <Modal open={confirmWipe} onClose={() => setConfirmWipe(false)} title="Reset workspace?" width="430px">
        <div className="p-5"><p className="text-[12.5px] leading-relaxed text-[var(--text-muted-strong)]">This removes every provider, chat, project and file from this browser and restores the Demo model. This cannot be undone.</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setConfirmWipe(false)} className="hv-btn hv-btn-secondary">Cancel</button><button onClick={() => { resetWorkspace(); setConfirmWipe(false); toast("Workspace reset"); }} className="hv-btn hv-btn-primary !bg-[var(--danger)]">Reset everything</button></div></div>
      </Modal>
    </div>
  );
}
