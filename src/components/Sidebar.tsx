import {
  Check,
  ChevronsUpDown,
  CircleHelp,
  Command,
  Download,
  Files,
  FolderClosed,
  FolderPlus,
  Keyboard,
  Languages,
  LockKeyhole,
  MoreHorizontal,
  Moon,
  MoveRight,
  PanelLeft,
  PenLine,
  Plus,
  Search,
  Settings,
  Star,
  Sun,
  Trash2,
  X,
  Laptop,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useWorkspace } from "../store/useWorkspace";
import type { Chat } from "../lib/types";
import { Avatar, Brand, Menu, MenuItem, MenuLabel, MenuSeparator, Modal, SunMark, Tip } from "./ui";

function groupChats(chats: Chat[]) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 86400000;
  const week = startToday - 86400000 * 7;
  const groups: { label: string; chats: Chat[] }[] = [
    { label: "Today", chats: [] },
    { label: "Yesterday", chats: [] },
    { label: "Previous 7 days", chats: [] },
    { label: "Older", chats: [] },
  ];
  [...chats]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach((chat) => {
      const stamp = Math.max(chat.updatedAt, chat.createdAt);
      if (stamp >= startToday) groups[0].chats.push(chat);
      else if (stamp >= startYesterday) groups[1].chats.push(chat);
      else if (stamp >= week) groups[2].chats.push(chat);
      else groups[3].chats.push(chat);
    });
  return groups.filter((group) => group.chats.length);
}

function exportChatText(chat: Chat, messages: ReturnType<typeof useWorkspace.getState>["messages"]) {
  const content = messages
    .filter((m) => m.chatId === chat.id)
    .map((m) => `## ${m.role === "user" ? "You" : m.model ?? "Assistant"}\n\n${m.content}`)
    .join("\n\n---\n\n");
  const blob = new Blob([`# ${chat.title}\n\n${content}`], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${chat.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ChatRow({ chat, collapsed, onNavigate, onRename, onMove }: { chat: Chat; collapsed: boolean; onNavigate?: () => void; onRename: (chat: Chat) => void; onMove: (chat: Chat) => void }) {
  const { currentChatId, openChat, updateChat, deleteChat, restoreChats, toast } = useWorkspace();
  const active = currentChatId === chat.id;

  const remove = () => {
    const state = useWorkspace.getState();
    const removedChat = state.chats.find((c) => c.id === chat.id);
    const removedMessages = state.messages.filter((m) => m.chatId === chat.id);
    deleteChat(chat.id);
    if (removedChat) {
      toast("Chat deleted", { label: "Undo", onClick: () => restoreChats([removedChat], removedMessages) });
    }
  };

  if (collapsed) {
    return (
      <Tip label={chat.title} side="right">
        <button
          onClick={() => { openChat(chat.id); onNavigate?.(); }}
          className={`relative flex size-9 items-center justify-center rounded-lg text-[11px] font-medium transition-colors ${active ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-muted-strong)] hover:bg-[var(--surface-hover)]"}`}
          aria-label={chat.title}
        >
          {chat.title.slice(0, 1).toUpperCase()}
          {chat.starred && <span className="absolute right-[3px] top-[3px] size-1.5 rounded-full bg-[var(--accent)]" />}
        </button>
      </Tip>
    );
  }

  return (
    <div className={`group/chat relative flex items-center rounded-lg transition-colors ${active ? "bg-[var(--surface)] text-[var(--text)] shadow-[0_1px_2px_rgba(31,30,29,.04)]" : "text-[var(--text-muted-strong)] hover:bg-[var(--surface-hover)]"}`}>
      <button
        onClick={() => { openChat(chat.id); onNavigate?.(); }}
        className="flex min-w-0 flex-1 items-center gap-2 py-[7px] pl-2.5 pr-8 text-left text-[13px]"
        aria-current={active ? "page" : undefined}
      >
        {chat.starred && <Star size={11} strokeWidth={1.5} className="shrink-0 fill-[var(--accent)] text-[var(--accent)]" />}
        <span className="truncate">{chat.title}</span>
      </button>
      <div className="absolute right-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/chat:opacity-100">
        <Menu
          className="flex size-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
          contentClassName="w-[190px]"
          trigger={<MoreHorizontal size={15} strokeWidth={1.5} />}
        >
          <MenuItem icon={<PenLine size={14} />} onSelect={() => onRename(chat)}>Rename</MenuItem>
          <MenuItem icon={<Star size={14} />} onSelect={() => updateChat(chat.id, { starred: !chat.starred })}>{chat.starred ? "Unstar" : "Star"}</MenuItem>
          <MenuItem icon={<MoveRight size={14} />} onSelect={() => onMove(chat)}>Move to project</MenuItem>
          <MenuItem icon={<Download size={14} />} onSelect={() => exportChatText(chat, useWorkspace.getState().messages)}>Export</MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Trash2 size={14} />} danger onSelect={remove}>Delete</MenuItem>
        </Menu>
      </div>
    </div>
  );
}

export function Sidebar({ mobileOpen, onCloseMobile }: { mobileOpen: boolean; onCloseMobile: () => void }) {
  const {
    chats, projects, files, newChat, sidebarCollapsed, toggleSidebar,
    page, setPage, settings, setTheme, openSettings, setCommandOpen, lockWorkspace, updateChat,
    toast, updateSettings, signedIn, clearProviderKeys,
  } = useWorkspace();
  const [renameChat, setRenameChat] = useState<Chat | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moveChat, setMoveChat] = useState<Chat | null>(null);
  const collapsed = sidebarCollapsed;
  const groups = useMemo(() => groupChats(chats), [chats]);
  const starred = chats.filter((c) => c.starred);
  const openPalette = () => { setCommandOpen(true); onCloseMobile(); };

  const startNew = () => { newChat(); onCloseMobile(); };
  const go = (target: "chats" | "projects" | "files") => { setPage(target); onCloseMobile(); };

  const saveRename = () => {
    if (renameChat && renameValue.trim()) updateChat(renameChat.id, { title: renameValue.trim() });
    setRenameChat(null);
    toast("Chat renamed");
  };

  const navItems = [
    { page: "chats" as const, label: "Chats", icon: PenLine, count: chats.length },
    { page: "projects" as const, label: "Projects", icon: FolderClosed, count: projects.length },
    { page: "files" as const, label: "Files", icon: Files, count: files.length },
  ];

  const content = (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-sidebar)]">
      <div className={`flex h-[58px] shrink-0 items-center border-b border-[var(--border-soft)] ${collapsed ? "flex-col justify-center gap-0.5 px-1 py-1" : "justify-between pl-4 pr-2.5"}`}>
        <button onClick={() => { setPage("chat"); newChat(); onCloseMobile(); }} className="min-w-0 rounded-md text-left" aria-label="HelioVision.Ai home">
          {collapsed ? <span className="text-[var(--accent)]"><SunMark size={20} /></span> : <Brand size={23} />}
        </button>
        {!collapsed && (
          <Tip label="Collapse sidebar" side="bottom">
            <button onClick={toggleSidebar} className="hv-icon-btn hidden md:inline-flex" aria-label="Collapse sidebar"><PanelLeft size={17} strokeWidth={1.5} /></button>
          </Tip>
        )}
        {collapsed && (
          <Tip label="Expand sidebar" side="right">
            <button onClick={toggleSidebar} className="hv-icon-btn" aria-label="Expand sidebar"><PanelLeft size={17} strokeWidth={1.5} /></button>
          </Tip>
        )}
        <Tip label="Close navigation"><button onClick={onCloseMobile} className="hv-icon-btn md:hidden"><X size={18} strokeWidth={1.5} /></button></Tip>
      </div>

      <div className={`shrink-0 ${collapsed ? "flex flex-col items-center px-2 pt-3" : "px-2.5 pt-3"}`}>
        {collapsed ? (
          <Tip label="New chat · ⌘⇧O" side="right">
            <button onClick={startNew} className="flex size-9 items-center justify-center rounded-lg text-[var(--accent-text)] hover:bg-[var(--surface-hover)]" aria-label="New chat"><Plus size={19} strokeWidth={1.6} /></button>
          </Tip>
        ) : (
          <button onClick={startNew} className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-[13.5px] font-[450] text-[var(--accent-text)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]">
            <Plus size={17} strokeWidth={1.6} /> New chat
            <span className="ml-auto hidden font-sans text-[10px] tracking-wide text-[var(--text-muted)] lg:inline">⌘⇧O</span>
          </button>
        )}
        <div className={`${collapsed ? "mt-2 flex flex-col items-center gap-1" : "mt-1.5 space-y-0.5"}`}>
          {collapsed ? (
            <>
              <Tip label="Search · ⌘K" side="right"><button onClick={openPalette} className="flex size-9 items-center justify-center rounded-lg text-[var(--text-muted-strong)] hover:bg-[var(--surface-hover)]" aria-label="Search"><Search size={18} strokeWidth={1.5} /></button></Tip>
              {navItems.map(({ page: target, label, icon: Icon }) => (
                <Tip key={target} label={label} side="right">
                  <button onClick={() => go(target)} className={`flex size-9 items-center justify-center rounded-lg ${page === target ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-muted-strong)] hover:bg-[var(--surface-hover)]"}`} aria-label={label}><Icon size={18} strokeWidth={1.5} /></button>
                </Tip>
              ))}
            </>
          ) : (
            <>
              <button onClick={openPalette} className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-[13px] text-[var(--text-muted-strong)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">
                <Search size={15.5} strokeWidth={1.5} /> Search chats <span className="ml-auto text-[10px] tracking-wide text-[var(--text-muted)]">⌘K</span>
              </button>
              {navItems.map(({ page: target, label, icon: Icon, count }) => (
                <button key={target} onClick={() => go(target)} className={`flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-[13px] transition-colors hover:bg-[var(--surface-hover)] ${page === target ? "bg-[var(--surface)] font-[450] text-[var(--text)] shadow-[0_1px_2px_rgba(31,30,29,.03)]" : "text-[var(--text-muted-strong)] hover:text-[var(--text)]"}`}>
                  <Icon size={15.5} strokeWidth={1.5} /> {label}
                  <span className="ml-auto tabular-nums text-[10.5px] text-[var(--text-muted)]">{count}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-4">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1 border-t border-[var(--border-soft)] pt-3">
            {starred.slice(0, 4).map((chat) => <ChatRow key={chat.id} chat={chat} collapsed onRename={setRenameChat} onMove={setMoveChat} />)}
          </div>
        ) : (
          <>
            {starred.length > 0 && (
              <section className="mb-4">
                <div className="flex h-6 items-center gap-1.5 px-2 text-[10px] font-[500] uppercase tracking-[0.1em] text-[var(--text-muted)]"><Star size={10} strokeWidth={1.6} /> Starred</div>
                <div className="mt-1 space-y-px">
                  {starred.slice(0, 4).map((chat) => <ChatRow key={chat.id} chat={chat} collapsed={false} onRename={(c) => { setRenameChat(c); setRenameValue(c.title); }} onMove={setMoveChat} />)}
                </div>
              </section>
            )}
            {groups.length === 0 && chats.length === 0 && (
              <div className="px-3 py-8 text-center">
                <div className="mx-auto mb-3 flex size-9 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--accent)]"><SunMark size={18} /></div>
                <p className="text-[12.5px] font-[450] text-[var(--text)]">Your first conversation starts here.</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--text-muted)]">Chats stay on this device.</p>
              </div>
            )}
            {groups.map((group) => (
              <section key={group.label} className="mb-2">
                <div className="flex h-7 items-center px-2 text-[10px] font-[500] uppercase tracking-[0.1em] text-[var(--text-muted)]">{group.label}</div>
                <div className="space-y-px">
                  {group.chats.slice(0, group.label === "Older" ? 4 : 8).map((chat) => (
                    <ChatRow key={chat.id} chat={chat} collapsed={false} onRename={(c) => { setRenameChat(c); setRenameValue(c.title); }} onMove={setMoveChat} />
                  ))}
                </div>
              </section>
            ))}
            {chats.length > 0 && (
              <button onClick={() => go("chats")} className="mt-1 flex items-center gap-1 px-2 py-1 text-[11.5px] text-[var(--text-muted-strong)] hover:text-[var(--accent-text)]">View all chats <MoveRight size={12} strokeWidth={1.5} /></button>
            )}
          </>
        )}
      </div>

      <div className={`shrink-0 border-t border-[var(--border-soft)] p-2.5 pb-[max(10px,env(safe-area-inset-bottom))] ${collapsed ? "flex flex-col items-center" : ""}`}>
        {!collapsed && (
          <div className="mb-2 flex items-center gap-2 px-2 text-[10.5px] text-[var(--text-muted)]">
            <span className="size-[5px] rounded-full bg-[var(--success)]" />
            {signedIn ? "Local workspace · all data private" : "Workspace locked"}
          </div>
        )}
        <Menu
          align={collapsed ? "center" : "start"}
          side="top"
          ariaLabel="Profile menu"
          contentClassName="w-[252px] mb-1"
          className={`flex w-full items-center rounded-lg text-left transition-colors hover:bg-[var(--surface-hover)] ${collapsed ? "h-10 w-10 justify-center" : "gap-2.5 p-1.5"}`}
          trigger={collapsed ? <Avatar name={settings.name} size={28} /> : (
            <>
              <Avatar name={settings.name} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-[500] leading-tight">{settings.name || "Your workspace"}</span>
                <span className="block truncate text-[10.5px] leading-tight text-[var(--text-muted)]">{settings.plan || "Personal workspace"}</span>
              </span>
              <ChevronsUpDown size={14} strokeWidth={1.5} className="text-[var(--text-muted)]" />
            </>
          )}
        >
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Avatar name={settings.name} size={34} />
            <div className="min-w-0"><div className="truncate text-[13px] font-[500]">{settings.name}</div><div className="text-[11px] text-[var(--text-muted)]">{settings.plan}</div></div>
          </div>
          <MenuSeparator />
          <MenuItem icon={<Settings size={14} />} onSelect={() => openSettings("general")}>Settings</MenuItem>
          <MenuItem icon={<Languages size={14} />} onSelect={() => { updateSettings({ language: "English" }); toast("Language set to English"); }}>Language <span className="text-[10.5px] text-[var(--text-muted)]">English</span></MenuItem>
          <MenuSeparator />
          <MenuLabel>Appearance</MenuLabel>
          <MenuItem icon={<Sun size={14} />} onSelect={() => setTheme("light")}>Light <span className="ml-auto text-[var(--text-muted)]">{settings.theme === "light" && <Check size={13} />}</span></MenuItem>
          <MenuItem icon={<Moon size={14} />} onSelect={() => setTheme("dark")}>Dark <span className="ml-auto text-[var(--text-muted)]">{settings.theme === "dark" && <Check size={13} />}</span></MenuItem>
          <MenuItem icon={<Laptop size={14} />} onSelect={() => setTheme("system")}>System <span className="ml-auto text-[var(--text-muted)]">{settings.theme === "system" && <Check size={13} />}</span></MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Command size={14} />} shortcut="⌘K" onSelect={() => setCommandOpen(true)}>Command palette</MenuItem>
          <MenuItem icon={<Keyboard size={14} />} shortcut="⌘/" onSelect={() => openSettings("shortcuts")}>Keyboard shortcuts</MenuItem>
          <MenuItem icon={<CircleHelp size={14} />} onSelect={() => openSettings("about")}>Help & about</MenuItem>
          <MenuItem icon={<FolderPlus size={14} />} onSelect={() => setPage("projects")}>New project</MenuItem>
          <MenuSeparator />
          <MenuItem icon={<LockKeyhole size={14} />} danger onSelect={() => { if (settings.keysLocked) clearProviderKeys(); lockWorkspace(); toast(settings.keysLocked ? "Workspace locked — keys cleared from memory" : "Workspace locked"); }}>Lock workspace</MenuItem>
        </Menu>
      </div>
    </div>
  );

  return (
    <>
      <aside className={`hidden h-screen shrink-0 transition-[width] duration-200 md:block ${collapsed ? "w-[64px]" : "w-[280px]"}`} style={{ background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-soft)" }}>
        {content}
      </aside>
      {mobileOpen && (
        <>
          <div className="hv-scrim md:hidden" onClick={onCloseMobile} />
          <aside className="animate-[drawer-in_200ms_var(--ease)] fixed inset-y-0 left-0 z-[60] w-[286px] border-r border-[var(--border-soft)] shadow-[var(--shadow-lg)] md:hidden">{content}</aside>
        </>
      )}

      <Modal open={Boolean(renameChat)} onClose={() => setRenameChat(null)} title="Rename chat" width="420px">
        <form onSubmit={(e) => { e.preventDefault(); saveRename(); }} className="p-5">
          <label className="hv-label" htmlFor="rename-chat">Chat title</label>
          <input id="rename-chat" autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="hv-input" maxLength={100} />
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setRenameChat(null)} className="hv-btn hv-btn-secondary">Cancel</button>
            <button type="submit" className="hv-btn hv-btn-primary">Save</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(moveChat)} onClose={() => setMoveChat(null)} title="Move to project" description={moveChat?.title} width="430px">
        <div className="space-y-1.5 overflow-y-auto p-4">
          <button onClick={() => { if (moveChat) updateChat(moveChat.id, { projectId: undefined }); setMoveChat(null); toast("Moved out of projects"); }} className="flex w-full items-center gap-3 rounded-lg border border-[var(--border-soft)] p-3 text-left text-[13px] hover:bg-[var(--surface-hover)]">
            <FolderClosed size={17} strokeWidth={1.5} className="text-[var(--text-muted)]" /> No project
            {!moveChat?.projectId && <Check size={14} className="ml-auto text-[var(--accent-text)]" />}
          </button>
          {projects.map((project) => (
            <button key={project.id} onClick={() => { if (moveChat) updateChat(moveChat.id, { projectId: project.id }); setMoveChat(null); toast(`Moved to ${project.name}`); }} className="flex w-full items-center gap-3 rounded-lg border border-[var(--border-soft)] p-3 text-left text-[13px] hover:bg-[var(--surface-hover)]">
              <span className="flex size-7 items-center justify-center rounded-md" style={{ background: `color-mix(in srgb, ${project.color} 16%, transparent)`, color: project.color }}><FolderClosed size={15} strokeWidth={1.5} /></span>
              <span className="min-w-0"><span className="block truncate font-[450]">{project.name}</span><span className="block truncate text-[11px] text-[var(--text-muted)]">{project.description}</span></span>
              {moveChat?.projectId === project.id && <Check size={14} className="ml-auto shrink-0 text-[var(--accent-text)]" />}
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
