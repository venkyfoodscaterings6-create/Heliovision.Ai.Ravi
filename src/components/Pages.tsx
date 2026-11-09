import {
  ArrowRight,
  Check,
  CheckSquare,
  Download,
  Eye,
  FileText,
  FolderClosed,
  FolderPlus,
  Menu as MenuIcon,
  MoreHorizontal,
  Pencil,
  PenLine,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useWorkspace } from "../store/useWorkspace";
import type { Chat, FileFormat, GeneratedFile, Project } from "../lib/types";
import { FORMAT_META, downloadFile } from "../lib/formats";
import { Menu, MenuItem, MenuSeparator, Modal, Tip, formatDate, formatRelative } from "./ui";
import { PreviewPanel } from "./FileCard";
import { uid } from "../lib/seed";

function PageHeader({ title, subtitle, onOpenMobile, actions }: { title: string; subtitle?: string; onOpenMobile: () => void; actions?: React.ReactNode }) {
  return (
    <header className="flex min-h-[64px] shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border-soft)] px-4 py-3 sm:px-7">
      <button onClick={onOpenMobile} className="hv-icon-btn md:hidden" aria-label="Open navigation"><MenuIcon size={19} strokeWidth={1.5} /></button>
      <div className="min-w-0 flex-1">
        <h1 className="text-[19px] font-[500] tracking-[-0.02em]">{title}</h1>
        {subtitle && <p className="mt-0.5 hidden text-[11.5px] text-[var(--text-muted)] sm:block">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </header>
  );
}

function EmptyPage({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-[var(--border)] px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--accent-text)]">{icon}</div>
      <h3 className="font-serif text-[20px]">{title}</h3>
      <p className="mt-1.5 max-w-[340px] text-[12px] leading-relaxed text-[var(--text-muted)]">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ChatsPage({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { chats, messages, projects, openChat, updateChat, deleteChat, restoreChats, newChat, toast } = useWorkspace();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<Chat | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [moving, setMoving] = useState<Chat | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Chat | null>(null);
  const filtered = useMemo(() => chats.filter((chat) => chat.title.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.updatedAt - a.updatedAt), [chats, query]);
  const allSelected = filtered.length > 0 && filtered.every((c) => selected.includes(c.id));

  const remove = (chat: Chat) => {
    const removedMessages = messages.filter((m) => m.chatId === chat.id);
    deleteChat(chat.id);
    setSelected((s) => s.filter((id) => id !== chat.id));
    setConfirmDelete(null);
    toast("Chat deleted", { label: "Undo", onClick: () => restoreChats([chat], removedMessages) });
  };
  const bulkDelete = () => {
    const removed = chats.filter((c) => selected.includes(c.id));
    const removedMessages = messages.filter((m) => selected.includes(m.chatId));
    removed.forEach((chat) => deleteChat(chat.id));
    setSelected([]);
    toast(`${removed.length} chats deleted`, { label: "Undo", onClick: () => restoreChats(removed, removedMessages) });
  };
  const startNew = () => { newChat(); };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Chats" subtitle="Every conversation, saved only in this browser." onOpenMobile={onOpenMobile} actions={<button onClick={startNew} className="hv-btn hv-btn-primary !h-8 text-[12px]"><Plus size={14} strokeWidth={1.6} /> New chat</button>} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-7 sm:py-8">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full max-w-[400px]">
              <Search size={15} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations…" className="hv-input !h-9 bg-[var(--surface)] pl-9 pr-8 text-[12.5px]" aria-label="Search conversations" />
              {query && <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]" aria-label="Clear search"><X size={13} /></button>}
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <button onClick={() => setSelected(allSelected ? [] : filtered.map((c) => c.id))} className={`hv-btn hv-btn-ghost !h-8 !px-2 text-[11.5px] ${allSelected ? "text-[var(--accent-text)]" : ""}`}><CheckSquare size={13} strokeWidth={1.5} /> {allSelected ? "Deselect all" : "Select all"}</button>
              <span className="text-[11px] text-[var(--text-muted)]">{chats.length} total</span>
            </div>
          </div>

          {selected.length > 0 && (
            <div className="mb-3 flex animate-fade items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[var(--accent-soft)] px-3 py-2">
              <span className="text-[12px] font-[450] text-[var(--accent-text)]">{selected.length} selected</span>
              <button onClick={bulkDelete} className="ml-auto flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--danger)] hover:underline"><Trash2 size={13} strokeWidth={1.5} /> Delete selected</button>
              <button onClick={() => setSelected([])} className="text-[11.5px] text-[var(--text-muted-strong)] hover:text-[var(--text)]">Cancel</button>
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyPage icon={query ? <Search size={21} strokeWidth={1.5} /> : <PenLine size={21} strokeWidth={1.5} />} title={query ? "No conversations found" : "A blank page, in the best way"} description={query ? `Nothing matched “${query}”. Try a different phrase.` : "Start a conversation and it will appear here, alongside everything else you are working through."} action={<button onClick={startNew} className="hv-btn hv-btn-primary text-[12px]"><Plus size={14} /> Start a conversation</button>} />
          ) : (
            <div className="overflow-hidden rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface)]">
              {filtered.map((chat, index) => {
                const project = projects.find((p) => p.id === chat.projectId);
                const count = messages.filter((m) => m.chatId === chat.id).length;
                return (
                  <div key={chat.id} className={`group flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)] sm:px-4 ${index > 0 ? "border-t border-[var(--border-soft)]" : ""}`}>
                    <button onClick={() => setSelected((s) => s.includes(chat.id) ? s.filter((id) => id !== chat.id) : [...s, chat.id])} className={`flex size-[17px] shrink-0 items-center justify-center rounded-[4px] border transition-colors ${selected.includes(chat.id) ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-[var(--surface)]"}`} aria-label={`Select ${chat.title}`}>{selected.includes(chat.id) && <Check size={11} />}</button>
                    <button onClick={() => openChat(chat.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--code-bg)] text-[var(--text-muted)]"><PenLine size={13} strokeWidth={1.5} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5"><span className="truncate text-[12.5px] font-[450] text-[var(--text)]">{chat.title}</span>{chat.starred && <Star size={10} className="shrink-0 fill-[var(--accent)] text-[var(--accent)]" />}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-[10.5px] text-[var(--text-muted)]"><span>{formatRelative(chat.updatedAt)}</span><span>·</span><span>{count} message{count === 1 ? "" : "s"}</span>{project && <><span>·</span><span className="flex items-center gap-1"><span className="size-1.5 rounded-full" style={{ background: project.color }} />{project.name}</span></>}</span>
                      </span>
                      <span className="hidden shrink-0 text-[10.5px] text-[var(--text-muted)] sm:block">{formatDate(chat.createdAt)}</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Tip label={chat.starred ? "Unstar" : "Star"}><button onClick={() => updateChat(chat.id, { starred: !chat.starred })} className={`hv-icon-btn !size-7 ${chat.starred ? "!text-[var(--accent)]" : ""}`}><Star size={13} strokeWidth={1.5} className={chat.starred ? "fill-current" : ""} /></button></Tip>
                      <Menu className="hv-icon-btn !size-7" align="end" contentClassName="w-[190px]" trigger={<MoreHorizontal size={15} strokeWidth={1.5} />}>
                        <MenuItem icon={<ArrowRight size={14} />} onSelect={() => openChat(chat.id)}>Open chat</MenuItem>
                        <MenuItem icon={<Pencil size={14} />} onSelect={() => { setRenaming(chat); setRenameValue(chat.title); }}>Rename</MenuItem>
                        <MenuItem icon={<FolderClosed size={14} />} onSelect={() => setMoving(chat)}>Move to project</MenuItem>
                        <MenuItem icon={<Star size={14} />} onSelect={() => updateChat(chat.id, { starred: !chat.starred })}>{chat.starred ? "Unstar" : "Star"}</MenuItem>
                        <MenuSeparator /><MenuItem icon={<Trash2 size={14} />} danger onSelect={() => setConfirmDelete(chat)}>Delete</MenuItem>
                      </Menu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Modal open={Boolean(renaming)} onClose={() => setRenaming(null)} title="Rename chat" width="420px">
        <form onSubmit={(e) => { e.preventDefault(); if (renaming && renameValue.trim()) updateChat(renaming.id, { title: renameValue.trim() }); setRenaming(null); }} className="p-5">
          <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="hv-input" maxLength={100} aria-label="Chat title" />
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setRenaming(null)} className="hv-btn hv-btn-secondary">Cancel</button><button className="hv-btn hv-btn-primary">Save</button></div>
        </form>
      </Modal>

      <Modal open={Boolean(moving)} onClose={() => setMoving(null)} title="Move to project" width="430px">
        <div className="space-y-1.5 p-4">
          <button onClick={() => { if (moving) updateChat(moving.id, { projectId: undefined }); setMoving(null); }} className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-soft)] p-3 text-left text-[12px] hover:bg-[var(--surface-hover)]"><FolderClosed size={15} /> No project</button>
          {projects.map((project) => <button key={project.id} onClick={() => { if (moving) updateChat(moving.id, { projectId: project.id }); setMoving(null); toast(`Moved to ${project.name}`); }} className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-soft)] p-3 text-left text-[12.5px] hover:bg-[var(--surface-hover)]"><span className="size-2 rounded-full" style={{ background: project.color }} />{project.name}<ArrowRight size={13} className="ml-auto text-[var(--text-muted)]" /></button>)}
        </div>
      </Modal>

      <Modal open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} title="Delete conversation?" width="420px">
        <div className="p-5"><p className="text-[12.5px] text-[var(--text-muted-strong)]">This removes “{confirmDelete?.title}” and all of its messages from this browser.</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setConfirmDelete(null)} className="hv-btn hv-btn-secondary">Cancel</button><button onClick={() => confirmDelete && remove(confirmDelete)} className="hv-btn hv-btn-primary !bg-[var(--danger)]">Delete</button></div></div>
      </Modal>
    </div>
  );
}

const PROJECT_COLORS = ["#D97757", "#7A8C67", "#8D7BA6", "#5B7C8F", "#B58B4C"];

export function ProjectsPage({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { projects, chats, addProject, updateProject, removeProject, toast } = useWorkspace();
  const [editor, setEditor] = useState<{ mode: "create" } | { mode: "edit"; project: Project } | null>(null);
  const [detail, setDetail] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [confirm, setConfirm] = useState<Project | null>(null);

  const openCreate = () => { setName(""); setDescription(""); setInstructions(""); setColor(PROJECT_COLORS[projects.length % PROJECT_COLORS.length]); setEditor({ mode: "create" }); };
  const openEdit = (project: Project) => { setName(project.name); setDescription(project.description); setInstructions(project.instructions); setColor(project.color); setEditor({ mode: "edit", project }); };
  const save = () => {
    if (!name.trim()) return;
    if (editor?.mode === "edit") {
      updateProject(editor.project.id, { name: name.trim(), description: description.trim(), instructions: instructions.trim(), color });
      setDetail((d) => d ? { ...d, name: name.trim(), description: description.trim(), instructions: instructions.trim(), color } : d);
      toast("Project updated");
    } else {
      addProject({ id: uid("project"), name: name.trim(), description: description.trim(), instructions: instructions.trim(), files: [], color, createdAt: Date.now(), updatedAt: Date.now() });
      toast("Project created");
    }
    setEditor(null);
  };
  const remove = (project: Project) => {
    const previousChats = chats.filter((c) => c.projectId === project.id).map((c) => ({ ...c }));
    removeProject(project.id);
    setConfirm(null);
    setDetail(null);
    toast("Project deleted", { label: "Undo", onClick: () => { addProject(project); previousChats.forEach((chat) => useWorkspace.getState().updateChat(chat.id, { projectId: project.id })); } });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Projects" subtitle="Give a body of work its own context, instructions and files." onOpenMobile={onOpenMobile} actions={<button onClick={openCreate} className="hv-btn hv-btn-primary !h-8 text-[12px]"><FolderPlus size={14} strokeWidth={1.6} /> New project</button>} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1050px] px-4 py-6 sm:px-7 sm:py-8">
          <div className="mb-5 hidden items-center gap-2 text-[11.5px] text-[var(--text-muted)] sm:flex"><FolderClosed size={13} strokeWidth={1.5} /> {projects.length} projects <span>·</span> Every project keeps its own system instructions.</div>
          {projects.length === 0 ? (
            <EmptyPage icon={<FolderClosed size={21} strokeWidth={1.5} />} title="Projects give your work a home" description="Group related conversations, pin the files that matter and give the assistant a consistent brief." action={<button onClick={openCreate} className="hv-btn hv-btn-primary text-[12px]"><FolderPlus size={14} /> Create your first project</button>} />
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => {
                const projectChats = chats.filter((c) => c.projectId === project.id);
                return (
                  <article key={project.id} className="group flex min-h-[188px] flex-col rounded-[14px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-left shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-px hover:border-[var(--border)] hover:shadow-[var(--shadow-md)]">
                    <div className="flex items-start justify-between">
                      <span className="flex size-9 items-center justify-center rounded-[10px]" style={{ color: project.color, background: `color-mix(in srgb, ${project.color} 13%, transparent)` }}><FolderClosed size={18} strokeWidth={1.5} /></span>
                      <Menu className="hv-icon-btn !size-7 opacity-60 group-hover:opacity-100" align="end" contentClassName="w-[170px]" trigger={<MoreHorizontal size={15} />}>
                        <MenuItem icon={<Eye size={14} />} onSelect={() => setDetail(project)}>Open project</MenuItem>
                        <MenuItem icon={<Pencil size={14} />} onSelect={() => openEdit(project)}>Edit project</MenuItem>
                        <MenuSeparator /><MenuItem icon={<Trash2 size={14} />} danger onSelect={() => setConfirm(project)}>Delete</MenuItem>
                      </Menu>
                    </div>
                    <button onClick={() => setDetail(project)} className="mt-3 text-left"><h3 className="font-serif text-[17px] font-[500] leading-tight group-hover:text-[var(--accent-text)]">{project.name}</h3><p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--text-muted-strong)]">{project.description || "No description yet."}</p></button>
                    <div className="mt-auto flex items-center gap-3 border-t border-[var(--border-soft)] pt-2.5 text-[10px] text-[var(--text-muted)]">
                      <span className="flex items-center gap-1"><PenLine size={10.5} /> {projectChats.length} chats</span>
                      <span className="flex items-center gap-1"><FileText size={10.5} /> {project.files.length} files</span>
                      <span className="ml-auto">{formatRelative(project.updatedAt)}</span>
                    </div>
                  </article>
                );
              })}
              <button onClick={openCreate} className="flex min-h-[188px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[var(--border)] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_4%,transparent)] hover:text-[var(--accent-text)]"><Plus size={22} strokeWidth={1.4} /><span className="mt-2 text-[12px]">New project</span></button>
            </div>
          )}
        </div>
      </div>

      <Modal open={Boolean(editor)} onClose={() => setEditor(null)} title={editor?.mode === "edit" ? "Edit project" : "New project"} description="A project is a shared brief for every conversation inside it." width="560px">
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="overflow-y-auto p-5">
          <label className="hv-label" htmlFor="project-name">Project name</label>
          <input id="project-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Northstar launch" className="hv-input" required />
          <div className="mt-4"><label className="hv-label" htmlFor="project-desc">Short description</label><input id="project-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this project for?" className="hv-input" /></div>
          <div className="mt-4"><label className="hv-label" htmlFor="project-instructions">Project instructions</label><textarea id="project-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Tell the assistant how to work with you on this project…" className="hv-input min-h-[105px]" rows={4} /><p className="mt-1 text-[10.5px] text-[var(--text-muted)]">Added quietly to every conversation in this project.</p></div>
          <div className="mt-4"><span className="hv-label">Colour</span><div className="flex gap-2">{PROJECT_COLORS.map((c) => <button type="button" key={c} onClick={() => setColor(c)} className={`flex size-7 items-center justify-center rounded-full border-2 ${color === c ? "border-[var(--text)]" : "border-transparent"}`} style={{ background: c }} aria-label={`Choose colour ${c}`}>{color === c && <Check size={12} className="text-white" />}</button>)}</div></div>
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setEditor(null)} className="hv-btn hv-btn-secondary">Cancel</button><button className="hv-btn hv-btn-primary">{editor?.mode === "edit" ? "Save changes" : "Create project"}</button></div>
        </form>
      </Modal>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.name} description={detail?.description} width="650px">
        {detail && (
          <div className="min-h-0 overflow-y-auto p-5">
            <div className="rounded-[10px] border border-[var(--border-soft)] bg-[var(--code-bg)] p-3.5"><div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)]">Instructions for the assistant</div><p className="text-[12.5px] leading-relaxed text-[var(--text-muted-strong)]">{detail.instructions || "No project instructions yet."}</p></div>
            <div className="mt-4 flex items-center justify-between"><h4 className="text-[12px] font-medium">Conversations</h4><span className="text-[10.5px] text-[var(--text-muted)]">{chats.filter((c) => c.projectId === detail.id).length}</span></div>
            <div className="mt-2 divide-y divide-[var(--border-soft)] overflow-hidden rounded-lg border border-[var(--border-soft)]">
              {chats.filter((c) => c.projectId === detail.id).slice(0, 6).map((chat) => <button key={chat.id} onClick={() => { useWorkspace.getState().openChat(chat.id); setDetail(null); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] hover:bg-[var(--surface-hover)]"><PenLine size={12} className="text-[var(--text-muted)]" /><span className="truncate">{chat.title}</span><span className="ml-auto text-[10px] text-[var(--text-muted)]">{formatRelative(chat.updatedAt)}</span></button>)}
              {!chats.some((c) => c.projectId === detail.id) && <p className="px-3 py-5 text-center text-[11.5px] text-[var(--text-muted)]">No conversations in this project yet.</p>}
            </div>
            <div className="mt-4"><h4 className="text-[12px] font-medium">Attached files</h4><div className="mt-2 flex flex-wrap gap-2">{detail.files.length ? detail.files.map((file) => <span key={file} className="flex items-center gap-1.5 rounded-md border border-[var(--border-soft)] px-2 py-1 text-[11px]"><FileText size={11} className="text-[var(--text-muted)]" />{file}</span>) : <p className="text-[11.5px] text-[var(--text-muted)]">Attach files from a conversation to keep them with this project.</p>}</div></div>
            <div className="mt-6 flex justify-between"><button onClick={() => { const d = detail; setDetail(null); setConfirm(d); }} className="hv-btn hv-btn-danger !h-8 text-[11.5px]"><Trash2 size={13} /> Delete project</button><div className="flex gap-2"><button onClick={() => { setDetail(null); useWorkspace.getState().openSettings("models"); }} className="hv-btn hv-btn-secondary">Project settings</button><button onClick={() => { const d = detail; setDetail(null); openEdit(d); }} className="hv-btn hv-btn-primary">Edit project</button></div></div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} title="Delete project?" width="430px">
        <div className="p-5"><p className="text-[12.5px] leading-relaxed text-[var(--text-muted-strong)]">The project brief will be removed. Conversations inside it will remain in your workspace.</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setConfirm(null)} className="hv-btn hv-btn-secondary">Cancel</button><button onClick={() => confirm && remove(confirm)} className="hv-btn hv-btn-primary !bg-[var(--danger)]">Delete project</button></div></div>
      </Modal>
    </div>
  );
}

const FORMAT_ICON: Record<FileFormat, React.ReactNode> = {
  xlsx: <FileText size={16} />, csv: <FileText size={16} />, docx: <FileText size={16} />, pdf: <FileText size={16} />, html: <FileText size={16} />, md: <FileText size={16} />, json: <FileText size={16} />, txt: <FileText size={16} />,
};

export function FilesPage({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { files, removeFile, addFile, toast, chats } = useWorkspace();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | FileFormat>("all");
  const [preview, setPreview] = useState<GeneratedFile | null>(null);
  const [confirm, setConfirm] = useState<GeneratedFile | null>(null);
  const filtered = files.filter((f) => (filter === "all" || f.format === filter) && f.name.toLowerCase().includes(query.toLowerCase()));
  const formats = Array.from(new Set(files.map((f) => f.format)));

  const download = async (file: GeneratedFile) => { await downloadFile(file); toast(`${FORMAT_META[file.format].label} downloaded`); };
  const remove = (file: GeneratedFile) => {
    removeFile(file.id);
    setConfirm(null);
    setPreview(null);
    toast("File removed", { label: "Undo", onClick: () => addFile(file) });
  };

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PageHeader title="Files" subtitle="Files generated by your conversations — kept locally and ready to open anywhere." onOpenMobile={onOpenMobile} actions={<span className="hv-badge !h-7 gap-1.5"><span className="size-[5px] rounded-full bg-[var(--success)]" /> {files.length} files</span>} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-7 sm:py-8">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full max-w-[380px]"><Search size={14} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files…" className="hv-input !h-9 pl-9 text-[12.5px]" aria-label="Search files" />{query && <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-label="Clear search"><X size={13} /></button>}</div>
              <div className="no-scrollbar flex gap-1 overflow-x-auto sm:ml-auto">
                {(["all", ...formats] as const).map((item) => <button key={item} onClick={() => setFilter(item as any)} className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${filter === item ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"}`}>{item === "all" ? "All" : FORMAT_META[item as FileFormat]?.label ?? item}</button>)}
              </div>
            </div>
            {filtered.length === 0 ? (
              <EmptyPage icon={<FileText size={21} strokeWidth={1.5} />} title={files.length ? "No files match" : "Your generated files will live here"} description={files.length ? "Try another search or format filter." : "Ask for an Excel workbook, a PDF, a slide-ready document or an HTML page in any conversation. Each one appears here."} action={files.length ? <button onClick={() => { setQuery(""); setFilter("all"); }} className="hv-btn hv-btn-secondary text-[12px]">Show all files</button> : undefined} />
            ) : (
              <div className="overflow-hidden rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface)]">
                <div className="hidden grid-cols-[1fr_80px_150px_100px] gap-3 border-b border-[var(--border-soft)] bg-[var(--code-bg)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)] sm:grid"><span>Name</span><span>Format</span><span>Created</span><span className="text-right">Actions</span></div>
                {filtered.map((file, index) => {
                  const chat = chats.find((c) => c.id === file.chatId);
                  return (
                    <div key={file.id} className={`group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-[var(--surface-hover)] sm:grid sm:grid-cols-[1fr_80px_150px_100px] sm:px-4 ${index > 0 ? "border-t border-[var(--border-soft)]" : ""}`}>
                      <button onClick={() => setPreview(file)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent-text)]">{FORMAT_ICON[file.format] ?? <FileText size={16} />}</span>
                        <span className="min-w-0"><span className="block truncate text-[12.5px] font-[450]">{file.name}</span><span className="block truncate text-[10px] text-[var(--text-muted)]">{chat ? `From “${chat.title}”` : "Generated file"} · {file.size ? `${(file.size / 1024).toFixed(1)} KB` : "Local"}</span></span>
                      </button>
                      <span className="hidden sm:block"><span className="hv-badge !h-5 text-[9.5px] uppercase tracking-wide">{FORMAT_META[file.format]?.label}</span></span>
                      <span className="hidden text-[10.5px] text-[var(--text-muted)] sm:block">{formatDate(file.createdAt)}</span>
                      <div className="flex items-center justify-end gap-0.5">
                        <Tip label="Preview"><button onClick={() => setPreview(file)} className="hv-icon-btn !size-7" aria-label={`Preview ${file.name}`}><Eye size={14} strokeWidth={1.5} /></button></Tip>
                        <Tip label="Download"><button onClick={() => void download(file)} className="hv-icon-btn !size-7" aria-label={`Download ${file.name}`}><Download size={14} strokeWidth={1.5} /></button></Tip>
                        <Tip label="Delete"><button onClick={() => setConfirm(file)} className="hv-icon-btn !size-7 hover:!text-[var(--danger)]" aria-label={`Delete ${file.name}`}><Trash2 size={14} strokeWidth={1.5} /></button></Tip>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-5 flex items-center justify-center gap-1.5 text-[10.5px] text-[var(--text-muted)]"><span className="size-[5px] rounded-full bg-[var(--success)]" /> Files are generated in your browser and never uploaded.</div>
          </div>
        </div>
      </div>
      {preview && <PreviewPanel file={preview} onClose={() => setPreview(null)} />}
      <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} title="Remove file?" width="420px">
        <div className="p-5"><p className="text-[12.5px] leading-relaxed text-[var(--text-muted-strong)]">“{confirm?.name}” will be removed from your Files page. You can undo this action.</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setConfirm(null)} className="hv-btn hv-btn-secondary">Cancel</button><button onClick={() => confirm && remove(confirm)} className="hv-btn hv-btn-primary !bg-[var(--danger)]">Remove file</button></div></div>
      </Modal>
    </div>
  );
}
