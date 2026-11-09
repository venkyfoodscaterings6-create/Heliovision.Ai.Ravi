import {
  Cpu,
  FileOutput,
  FolderClosed,
  Keyboard,
  Moon,
  PenLine,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "../store/useWorkspace";
import { SunMark } from "./ui";
import { formatRelative } from "./ui";

export function CommandPalette() {
  const {
    commandOpen, setCommandOpen, chats, openChat, newChat, setPage, openSettings,
    setTheme, settings, projects, files, openSettings: openSettingsAction,
  } = useWorkspace();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!commandOpen) return;
    setQuery("");
    setActive(0);
    window.setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setCommandOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [commandOpen, setCommandOpen]);

  const lower = query.toLowerCase();
  const chatResults = useMemo(() => chats.filter((c) => c.title.toLowerCase().includes(lower)).slice(0, 5), [chats, lower]);
  const projectResults = useMemo(() => projects.filter((p) => p.name.toLowerCase().includes(lower)).slice(0, 3), [projects, lower]);

  const actions = [
    { label: "New conversation", hint: "⌘ ⇧ O", icon: Plus, run: () => newChat() },
    { label: "Open Chats", hint: `${chats.length} chats`, icon: PenLine, run: () => setPage("chats") },
    { label: "Open Projects", hint: `${projects.length} projects`, icon: FolderClosed, run: () => setPage("projects") },
    { label: "Open Files", hint: `${files.length} files`, icon: FileOutput, run: () => setPage("files") },
    { label: "Models & providers", hint: "Settings", icon: Cpu, run: () => openSettingsAction("models") },
    { label: "Output formats", hint: "Settings", icon: FileOutput, run: () => openSettingsAction("formats") },
    { label: "Data & privacy", hint: "Settings", icon: ShieldCheck, run: () => openSettingsAction("data") },
    { label: "General settings", hint: "Settings", icon: UserRound, run: () => openSettingsAction("general") },
    { label: "Keyboard shortcuts", hint: "⌘ /", icon: Keyboard, run: () => openSettingsAction("shortcuts") },
    { label: settings.theme === "dark" ? "Switch to light theme" : "Switch to dark theme", hint: "Appearance", icon: settings.theme === "dark" ? Sun : Moon, run: () => setTheme(settings.theme === "dark" ? "light" : "dark") },
    { label: "Open settings", hint: "Preferences", icon: Settings, run: () => openSettings("general") },
  ].filter((a) => !query || a.label.toLowerCase().includes(lower));

  const flattened = [
    ...chatResults.map((chat) => ({ key: chat.id, type: "chat" as const, label: chat.title, hint: formatRelative(chat.updatedAt), run: () => openChat(chat.id) })),
    ...projectResults.map((project) => ({ key: project.id, type: "project" as const, label: project.name, hint: "Project", run: () => { setPage("projects"); useWorkspace.setState({}); } })),
    ...actions.map((action) => ({ key: action.label, type: "action" as const, label: action.label, hint: action.hint, icon: action.icon, run: action.run })),
  ];

  useEffect(() => {
    if (!commandOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") { event.preventDefault(); setActive((a) => Math.min(a + 1, flattened.length - 1)); }
      if (event.key === "ArrowUp") { event.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      if (event.key === "Enter" && flattened[active]) { event.preventDefault(); flattened[active].run(); setCommandOpen(false); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [commandOpen, flattened, active, setCommandOpen]);

  if (!commandOpen) return null;

  let itemIndex = -1;

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center px-3 pt-[10vh] sm:pt-[14vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <button className="absolute inset-0 bg-[rgba(20,20,19,.38)] backdrop-blur-[2px]" onClick={() => setCommandOpen(false)} aria-label="Close command palette" />
      <div className="animate-slide-up relative w-full max-w-[570px] overflow-hidden rounded-[15px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
        <div className="flex h-[52px] items-center gap-2.5 border-b border-[var(--border-soft)] px-4">
          <Search size={17} strokeWidth={1.5} className="shrink-0 text-[var(--text-muted)]" />
          <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} placeholder="Search chats or run a command…" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-[var(--text-muted)]" aria-label="Search chats or commands" />
          <button onClick={() => setCommandOpen(false)} className="hv-icon-btn !size-7" aria-label="Close"><X size={14} /></button>
        </div>
        <div className="max-h-[min(430px,60vh)] overflow-y-auto p-1.5">
          {chatResults.length > 0 && <div className="px-2.5 pb-1 pt-2 text-[9.5px] font-medium uppercase tracking-[0.11em] text-[var(--text-muted)]">Conversations</div>}
          {chatResults.map((chat) => { itemIndex++; const i = itemIndex; return (
            <button key={chat.id} onMouseEnter={() => setActive(i)} onClick={() => { openChat(chat.id); setCommandOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left ${active === i ? "bg-[var(--surface-hover)]" : ""}`}>
              <PenLine size={14} strokeWidth={1.5} className="text-[var(--text-muted)]" /><span className="min-w-0 flex-1 truncate text-[12.5px]">{chat.title}</span>{chat.starred && <span className="text-[var(--accent)]">★</span>}<span className="text-[10px] text-[var(--text-muted)]">{formatRelative(chat.updatedAt)}</span>
            </button>
          ); })}
          {projectResults.length > 0 && <div className="px-2.5 pb-1 pt-3 text-[9.5px] font-medium uppercase tracking-[0.11em] text-[var(--text-muted)]">Projects</div>}
          {projectResults.map((project) => { itemIndex++; const i = itemIndex; return (
            <button key={project.id} onMouseEnter={() => setActive(i)} onClick={() => { setPage("projects"); setCommandOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left ${active === i ? "bg-[var(--surface-hover)]" : ""}`}>
              <FolderClosed size={14} strokeWidth={1.5} className="text-[var(--text-muted)]" /><span className="min-w-0 flex-1 truncate text-[12.5px]">{project.name}</span><span className="text-[10px] text-[var(--text-muted)]">{project.description.slice(0, 28)}</span>
            </button>
          ); })}
          {actions.length > 0 && <div className="px-2.5 pb-1 pt-3 text-[9.5px] font-medium uppercase tracking-[0.11em] text-[var(--text-muted)]">Actions</div>}
          {actions.map((action) => { itemIndex++; const i = itemIndex; const Icon = action.icon; return (
            <button key={action.label} onMouseEnter={() => setActive(i)} onClick={() => { action.run(); setCommandOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left ${active === i ? "bg-[var(--surface-hover)]" : ""}`}>
              <Icon size={14} strokeWidth={1.5} className="text-[var(--text-muted)]" /><span className="min-w-0 flex-1 truncate text-[12.5px]">{action.label}</span><span className="text-[10px] text-[var(--text-muted)]">{action.hint}</span>
            </button>
          ); })}
          {!flattened.length && (
            <div className="flex flex-col items-center px-6 py-10 text-center"><span className="text-[var(--accent)]"><SunMark size={22} /></span><div className="mt-2 text-[12.5px] font-[450]">No matches for “{query}”</div><p className="mt-1 text-[10.5px] text-[var(--text-muted)]">Try a chat title, a page name or an action.</p></div>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-[var(--border-soft)] bg-[var(--code-bg)] px-3.5 py-2 text-[9.5px] text-[var(--text-muted)]"><span className="flex items-center gap-1"><kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1">↑</kbd><kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1">↓</kbd> navigate</span><span className="flex items-center gap-1"><kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1">↵</kbd> select</span><span className="flex items-center gap-1"><kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1">esc</kbd> close</span><span className="ml-auto flex items-center gap-1.5"><SunMark size={11} /> HelioVision.Ai</span></div>
      </div>
    </div>
  );
}
