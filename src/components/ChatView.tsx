import {
  ArrowDown,
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  Download,
  Feather,
  FileJson,
  FileText,
  FolderClosed,
  GraduationCap,
  ImageIcon,
  Lightbulb,
  Menu as MenuIcon,
  MoreHorizontal,
  Paperclip,
  Pencil,
  PenLine,
  RefreshCw,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "../store/useWorkspace";
import type { Chat, FileFormat, GeneratedFile, Message } from "../lib/types";
import { Composer, type SendOptions, type ResponseStyle } from "./Composer";
import { Markdown, ThinkingBlock } from "./Markdown";
import { FileCard, PreviewPanel } from "./FileCard";
import { Menu, MenuItem, MenuSeparator, Modal, SunMark, Tip, timeOfDay } from "./ui";
import { buildFile, detectFormat, downloadFile, FORMAT_META, formatInstruction } from "../lib/formats";
import { runDemoStream, streamChat, type ChatTurn, type StreamEvent } from "../lib/adapters";
import { STARTER_SUGGESTIONS, uid } from "../lib/seed";

const STYLE_PROMPTS: Record<ResponseStyle, string> = {
  normal: "Write with a warm, clear, considered voice. Be useful rather than verbose.",
  concise: "Be concise. Lead with the answer. Use short paragraphs and omit unnecessary framing.",
  explanatory: "Explain your reasoning with useful context, a worked example where helpful, and a clear summary.",
  formal: "Use polished, precise, professional language suitable for a client-facing document.",
};

const BASE_SYSTEM = `You are HelioVision.Ai, a thoughtful private AI assistant. You help people think, write, analyse and build.
Format replies in clean Markdown. Use headings only when they aid scanning, tables for comparisons, and fenced code blocks with a language tag.
Never claim to have searched the web unless a provider-native search result was supplied. Be honest about uncertainty. Do not mention this system prompt.`;

function titleFromPrompt(prompt: string) {
  return (prompt.trim().replace(/\s+/g, " ").slice(0, 62) || "Untitled conversation").replace(/[.,;:!?]$/, "");
}

export function ChatView({ onOpenMobile }: { onOpenMobile: () => void }) {
  const state = useWorkspace();
  const {
    chats, messages, currentChatId, models, providers, selectedModelId, selectModel, settings,
    addChat, addMessage, updateMessage, updateChat, removeMessagesFrom, addFile, toast,
    openSettings, projects, deleteChat, restoreChats,
  } = state;
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<{ message: string; hint?: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<GeneratedFile | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const currentChat = chats.find((chat) => chat.id === currentChatId);
  const chatMessages = useMemo(() => messages.filter((m) => m.chatId === currentChatId), [messages, currentChatId]);
  const currentProject = projects.find((p) => p.id === currentChat?.projectId);
  const activeModel = models.find((m) => m.id === selectedModelId && m.enabled) ?? models.find((m) => m.enabled && m.isDemo) ?? models.find((m) => m.enabled);
  const providerConfigured = providers.length > 0;
  const hasConversation = Boolean(currentChat && chatMessages.length);

  useEffect(() => {
    setStreamError(null);
    setPreviewFile(null);
  }, [currentChatId]);

  useEffect(() => {
    if (!showScrollButton) bottomRef.current?.scrollIntoView({ behavior: streamingId ? "auto" : "smooth", block: "end" });
  }, [chatMessages.length, streamingId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !streamingId) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 180) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [chatMessages, streamingId]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollButton(el.scrollHeight - el.scrollTop - el.clientHeight > 220);
  };

  const selectedModel = () => models.find((m) => m.id === selectedModelId && m.enabled) ?? models.find((m) => m.isDemo) ?? models.find((m) => m.enabled);

  const runGeneration = async ({
    chatId,
    assistantId,
    turns,
    prompt,
    options,
    modelId,
  }: {
    chatId: string;
    assistantId: string;
    turns: ChatTurn[];
    prompt: string;
    options: SendOptions;
    modelId?: string;
  }) => {
    const model = models.find((m) => m.id === (modelId ?? selectedModelId)) ?? selectedModel();
    if (!model) {
      setStreamError({ message: "No model is enabled. Add one in Settings → Models & Providers." });
      updateMessage(assistantId, { content: "" });
      return;
    }
    const provider = providers.find((p) => p.id === model.providerId);
    if (!model.isDemo && !provider) {
      setStreamError({ message: "This model's provider is no longer available.", hint: "Open Settings → Models & Providers to reconnect it." });
      return;
    }
    if (!model.isDemo && provider && !provider.apiKey && !provider.baseUrl.includes("localhost")) {
      setStreamError({ message: `No API key is saved for ${provider.name}.`, hint: "Add a key in Settings → Models & Providers, or choose the Demo model to keep exploring." });
      return;
    }
    const project = projects.find((p) => p.id === options.projectId) ?? projects.find((p) => p.id === currentChat?.projectId) ?? (options.projectId ? undefined : currentProject);
    const system = [
      BASE_SYSTEM,
      STYLE_PROMPTS[options.style],
      project ? `Project instructions (${project.name}): ${project.instructions}` : "",
      options.format ? formatInstruction(options.format) : "",
    ].filter(Boolean).join("\n\n");
    const controller = new AbortController();
    abortRef.current = controller;
    setStreamingId(assistantId);
    setStreamError(null);
    let content = "";
    let reasoning = "";
    const start = Date.now();
    const onEvent = (event: StreamEvent) => {
      if (event.type === "text") {
        content += event.text;
        updateMessage(assistantId, { content, reasoning, thinkingMs: reasoning ? Date.now() - start : undefined });
      } else if (event.type === "reasoning") {
        reasoning += event.text;
        updateMessage(assistantId, { content, reasoning, thinkingMs: Date.now() - start });
      } else if (event.type === "error") {
        setStreamError({
          message: event.error,
          hint: event.code === "cors" ? "Enable ‘Route through proxy’ in provider settings to get around CORS." : event.code === "model" ? "Open Settings to confirm the exact model ID." : "Your key and conversation never leave this browser.",
        });
      } else if (event.type === "done") {
        updateMessage(assistantId, { content, reasoning, thinkingMs: reasoning ? Date.now() - start : undefined });
      }
    };

    try {
      if (model.isDemo) {
        await runDemoStream(prompt, turns, onEvent, controller.signal, { thinking: options.thinking, webSearch: options.webSearch, formatLabel: options.format ? FORMAT_META[options.format].label : undefined });
      } else if (provider) {
        await streamChat({ provider, model, turns, system, signal: controller.signal, onEvent, thinking: options.thinking, webSearch: options.webSearch });
      }
    } catch (error) {
      if (!controller.signal.aborted) setStreamError({ message: error instanceof Error ? error.message : "The request could not be completed." });
    } finally {
      const finalContent = useWorkspace.getState().messages.find((m) => m.id === assistantId)?.content ?? content;
      if (!controller.signal.aborted && finalContent.trim() && options.format) {
        try {
          const file = await buildFile(options.format, finalContent, prompt, settings.fileNamePattern);
          file.chatId = chatId;
          addFile(file);
          const existing = useWorkspace.getState().messages.find((m) => m.id === assistantId)?.files ?? [];
          updateMessage(assistantId, { files: [...existing, file] });
          setPreviewFile(file);
          toast(`${FORMAT_META[options.format].label} file ready`);
        } catch {
          toast("The reply is ready, but the file could not be generated.");
        }
      }
      setStreamingId(null);
      abortRef.current = null;
    }
  };

  const handleSend = (options: SendOptions) => {
    if (!options.text && options.attachments.length === 0) return;
    const model = selectedModel();
    if (!model) { openSettings("models"); return; }
    let chatId = currentChatId;
    if (!chatId || !chats.some((c) => c.id === chatId)) {
      chatId = uid("chat");
      const chat: Chat = {
        id: chatId,
        title: titleFromPrompt(options.text || options.attachments[0]?.name || "New conversation"),
        starred: false,
        projectId: options.projectId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addChat(chat);
      useWorkspace.setState({ currentChatId: chatId });
    } else if (options.projectId && currentChat?.projectId !== options.projectId) {
      updateChat(chatId, { projectId: options.projectId });
    }
    const priorMessages = useWorkspace.getState().messages.filter((m) => m.chatId === chatId);
    const userMessage: Message = {
      id: uid("msg"), chatId, role: "user", content: options.text, attachments: options.attachments, createdAt: Date.now(),
    };
    const assistantId = uid("msg");
    const assistantMessage: Message = {
      id: assistantId, chatId, role: "assistant", content: "", createdAt: Date.now() + 1,
      model: model.name, providerId: model.providerId,
      providerName: providers.find((p) => p.id === model.providerId)?.name ?? "Demo workspace",
    };
    addMessage(userMessage);
    addMessage(assistantMessage);
    const turns: ChatTurn[] = [...priorMessages.map((m) => ({ role: m.role, content: m.content, attachments: m.attachments })), { role: "user", content: options.text, attachments: options.attachments }];
    void runGeneration({ chatId, assistantId, turns, prompt: options.text, options, modelId: model.id });
  };

  const retry = (assistantId: string, modelId?: string) => {
    if (!currentChatId) return;
    const all = useWorkspace.getState().messages.filter((m) => m.chatId === currentChatId);
    const index = all.findIndex((m) => m.id === assistantId);
    if (index < 1) return;
    const prior = all.slice(0, index);
    const lastUser = [...prior].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const newId = uid("msg");
    removeMessagesFrom(currentChatId, assistantId);
    const model = models.find((m) => m.id === (modelId ?? selectedModelId)) ?? selectedModel();
    addMessage({ id: newId, chatId: currentChatId, role: "assistant", content: "", createdAt: Date.now(), model: model?.name, providerId: model?.providerId, providerName: providers.find((p) => p.id === model?.providerId)?.name ?? "Demo workspace" });
    const format = detectFormat(lastUser.content, settings.enabledFormats);
    void runGeneration({
      chatId: currentChatId, assistantId: newId,
      turns: prior.map((m) => ({ role: m.role, content: m.content, attachments: m.attachments })),
      prompt: lastUser.content,
      options: { text: lastUser.content, attachments: lastUser.attachments ?? [], webSearch: false, thinking: false, format, style: "normal" },
      modelId,
    });
  };

  const saveEdit = () => {
    if (!editingMessage || !currentChatId) return;
    const all = useWorkspace.getState().messages.filter((m) => m.chatId === currentChatId);
    const index = all.findIndex((m) => m.id === editingMessage.id);
    const edited = { ...all[index], content: editingMessage.text, createdAt: Date.now() };
    const prior = all.slice(0, index);
    removeMessagesFrom(currentChatId, editingMessage.id);
    const assistantId = uid("msg");
    const model = selectedModel();
    const userMessage = { ...edited, id: uid("msg") };
    addMessage(userMessage);
    addMessage({ id: assistantId, chatId: currentChatId, role: "assistant", content: "", createdAt: Date.now(), model: model?.name, providerId: model?.providerId, providerName: providers.find((p) => p.id === model?.providerId)?.name ?? "Demo workspace" });
    setEditingMessage(null);
    const options: SendOptions = { text: edited.content, attachments: edited.attachments ?? [], webSearch: false, thinking: false, format: detectFormat(edited.content, settings.enabledFormats), style: "normal" };
    void runGeneration({ chatId: currentChatId, assistantId, turns: [...prior.map((m) => ({ role: m.role, content: m.content, attachments: m.attachments })), { role: "user", content: edited.content, attachments: edited.attachments }], prompt: edited.content, options });
  };

  const stop = () => {
    abortRef.current?.abort();
    setStreamingId(null);
    toast("Generation stopped");
  };

  const exportConversation = async (format: FileFormat) => {
    if (!currentChat) return;
    const markdown = `# ${currentChat.title}\n\n` + chatMessages.map((m) => `${m.role === "user" ? "**You**" : `**${m.model ?? "Assistant"}**`}\n\n${m.content}`).join("\n\n---\n\n");
    const file = await buildFile(format, markdown, currentChat.title, settings.fileNamePattern);
    await downloadFile(file);
    toast(`${FORMAT_META[format].label} exported`);
  };

  const rename = () => {
    if (!currentChat || !titleDraft.trim()) { setRenaming(false); return; }
    updateChat(currentChat.id, { title: titleDraft.trim() });
    setRenaming(false);
    toast("Chat renamed");
  };

  const removeChat = () => {
    if (!currentChat) return;
    const removedChat = currentChat;
    const removedMessages = [...chatMessages];
    deleteChat(currentChat.id);
    setDeleteOpen(false);
    toast("Chat deleted", { label: "Undo", onClick: () => restoreChats([removedChat], removedMessages) });
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${settings.chatFont === "serif" ? "font-chat-serif" : settings.chatFont === "sans" ? "font-chat-sans" : settings.chatFont === "dyslexic" ? "font-chat-dyslexic" : ""}`}>
        <header className="flex h-[54px] shrink-0 items-center gap-2 px-3 sm:px-5">
          <button onClick={onOpenMobile} className="hv-icon-btn md:hidden" aria-label="Open navigation"><MenuIcon size={19} strokeWidth={1.5} /></button>
          <div className="min-w-0 flex-1">
            {currentChat ? (
              renaming ? (
                <form onSubmit={(e) => { e.preventDefault(); rename(); }} className="flex items-center gap-1">
                  <input autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={rename} className="h-7 max-w-[420px] rounded border border-[var(--border)] bg-[var(--surface)] px-2 text-[13px] font-[450] outline-none focus:border-[var(--accent)]" />
                </form>
              ) : (
                <button onClick={() => { setTitleDraft(currentChat.title); setRenaming(true); }} className="group flex max-w-full items-center gap-1.5 truncate rounded-md px-1 py-0.5 text-[13px] font-[450] text-[var(--text)] hover:bg-[var(--surface-hover)]">
                  <span className="truncate">{currentChat.title}</span>
                  <Pencil size={11} strokeWidth={1.5} className="shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              )
            ) : (
              <span className="flex items-center gap-1.5 px-1 text-[12.5px] text-[var(--text-muted)]"><span className="text-[var(--accent)]"><SunMark size={13} /></span> New conversation</span>
            )}
            {currentChat && currentProject && (
              <button onClick={() => { useWorkspace.getState().setPage("projects"); }} className="ml-1 flex items-center gap-1 truncate text-[10.5px] text-[var(--text-muted)] hover:text-[var(--accent-text)]"><FolderClosed size={10} /> {currentProject.name}</button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {currentChat && (
              <Menu className="hv-btn hv-btn-ghost !h-8 !px-2 text-[12px] text-[var(--text-muted-strong)]" align="end" contentClassName="w-[200px]" trigger={<><Download size={14} strokeWidth={1.5} /><span className="hidden sm:inline">Export</span><ChevronDown size={11} strokeWidth={1.5} className="hidden sm:block" /></>}>
                <MenuItem icon={<FileText size={14} />} onSelect={() => { void exportConversation("md"); }}>Markdown (.md)</MenuItem>
                <MenuItem icon={<FileText size={14} />} onSelect={() => { void exportConversation("pdf"); }}>PDF document</MenuItem>
                <MenuItem icon={<FileText size={14} />} onSelect={() => { void exportConversation("html"); }}>HTML page</MenuItem>
                <MenuItem icon={<FileJson size={14} />} onSelect={() => { void exportConversation("json"); }}>JSON data</MenuItem>
                <MenuItem icon={<FileText size={14} />} onSelect={() => { void exportConversation("docx"); }}>Word document</MenuItem>
              </Menu>
            )}
            {currentChat && (
              <Menu className="hv-icon-btn" align="end" contentClassName="w-[190px]" trigger={<MoreHorizontal size={17} strokeWidth={1.5} />}>
                <MenuItem icon={<Pencil size={14} />} onSelect={() => { setTitleDraft(currentChat.title); setRenaming(true); }}>Rename</MenuItem>
                <MenuItem icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/></svg>} onSelect={() => updateChat(currentChat.id, { starred: !currentChat.starred })}>{currentChat.starred ? "Unstar chat" : "Star chat"}</MenuItem>
                <MenuSeparator />
                <MenuItem icon={<Trash2 size={14} />} danger onSelect={() => setDeleteOpen(true)}>Delete conversation</MenuItem>
              </Menu>
            )}
            {!currentChat && <span className="hidden items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1 text-[10px] text-[var(--text-muted-strong)] sm:flex"><span className="size-[5px] rounded-full bg-[var(--success)]" /> Private by design</span>}
          </div>
        </header>

        {hasConversation ? (
          <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto w-full max-w-[768px] px-4 pb-6 pt-8 sm:px-6">
              {currentProject && (
                <div className="mb-7 flex items-start gap-2.5 rounded-lg border border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--surface-hover)_55%,transparent)] px-3.5 py-2.5 font-sans">
                  <span className="mt-0.5 flex size-6 items-center justify-center rounded-md" style={{ background: `color-mix(in srgb, ${currentProject.color} 16%, transparent)`, color: currentProject.color }}><FolderClosed size={13} strokeWidth={1.5} /></span>
                  <div className="min-w-0"><span className="text-[11px] font-medium">{currentProject.name}</span><span className="ml-2 text-[10.5px] text-[var(--text-muted)]">Project instructions active</span><p className="mt-0.5 line-clamp-1 text-[10.5px] text-[var(--text-muted)]">{currentProject.instructions}</p></div>
                </div>
              )}
              <div className="space-y-8">
                {chatMessages.slice(-120).map((message) => (
                  <MessageItem
                    key={message.id}
                    message={message}
                    streaming={streamingId === message.id}
                    error={streamingId === message.id || message.id === chatMessages[chatMessages.length - 1]?.id ? streamError : null}
                    editing={editingMessage?.id === message.id ? editingMessage : null}
                    setEditing={setEditingMessage}
                    onSaveEdit={saveEdit}
                    onCopy={() => { void navigator.clipboard.writeText(message.content); toast("Copied to clipboard"); }}
                    onFeedback={(value) => updateMessage(message.id, { feedback: message.feedback === value ? undefined : value })}
                    onRetry={(modelId) => retry(message.id, modelId)}
                    onDelete={() => {
                      const removed = message;
                      removeMessagesFrom(currentChatId!, message.id);
                      toast("Message and replies deleted", { label: "Undo", onClick: () => addMessage(removed) });
                    }}
                    models={models.filter((m) => m.enabled)}
                    onPreview={setPreviewFile}
                  />
                ))}
              </div>
              <div ref={bottomRef} className="h-4" />
            </div>
          </div>
        ) : (
          <EmptyState
            name={settings.name}
            hasProvider={providerConfigured}
            onSend={handleSend}
            streaming={Boolean(streamingId)}
            onStop={stop}
            onAddProvider={() => openSettings("models")}
            onDemo={() => selectModel(models.find((m) => m.isDemo)?.id ?? selectedModelId)}
            demoSelected={Boolean(activeModel?.isDemo)}
            onProject={() => openSettings("models")}
          />
        )}

        {hasConversation && <div className="relative shrink-0 bg-[linear-gradient(to_top,var(--bg)_75%,transparent)] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-4">
          {showScrollButton && (
            <button onClick={() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); setShowScrollButton(false); }} className="absolute -top-12 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11.5px] text-[var(--text-muted-strong)] shadow-[var(--shadow-md)] hover:text-[var(--text)]" aria-label="Scroll to bottom"><ArrowDown size={13} strokeWidth={1.5} /> Latest</button>
          )}
          <div className="mx-auto w-full max-w-[768px]">
            <Composer onSend={handleSend} streaming={Boolean(streamingId)} onStop={stop} />
            <p className="mt-2 text-center text-[10.5px] leading-relaxed text-[var(--text-muted)]">HelioVision.Ai can make mistakes. Please double-check responses. <span className="hidden sm:inline">Your keys and chats stay on this device.</span></p>
          </div>
        </div>}
      </div>

      {previewFile && <PreviewPanel file={previewFile} onClose={() => setPreviewFile(null)} />}

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete this conversation?" width="430px">
        <div className="p-5">
          <p className="text-[13px] leading-relaxed text-[var(--text-muted-strong)]">“{currentChat?.title}” and its messages will be removed from this browser. You can undo immediately afterwards.</p>
          <div className="mt-5 flex justify-end gap-2"><button onClick={() => setDeleteOpen(false)} className="hv-btn hv-btn-secondary">Cancel</button><button onClick={removeChat} className="hv-btn hv-btn-primary !bg-[var(--danger)]">Delete chat</button></div>
        </div>
      </Modal>
    </div>
  );
}

function EmptyState({ name, hasProvider, onSend, streaming, onStop, onAddProvider, onDemo, demoSelected, onProject }: { name: string; hasProvider: boolean; onSend: (options: SendOptions) => void; streaming: boolean; onStop: () => void; onAddProvider: () => void; onDemo: () => void; demoSelected: boolean; onProject: () => void }) {
  const suggestions = STARTER_SUGGESTIONS;
  const icons = [Feather, GraduationCap, PenLine, FileText, Lightbulb];
  const projects = useWorkspace((s) => s.projects);
  const chatCount = useWorkspace((s) => s.chats.length);
  const [starter, setStarter] = useState("");
  const [composerKey, setComposerKey] = useState(0);
  const firstName = name.trim().split(/\s+/)[0];
  const usePrompt = (prompt: string) => { setStarter(prompt); setComposerKey((k) => k + 1); };
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[768px] flex-col justify-center px-5 pb-6 pt-6 sm:px-6 sm:pt-10">
        <div className="animate-slide-up">
          <div className="mb-4 flex items-center gap-2 text-[var(--accent)]"><SunMark size={24} /><span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">A quieter place to think</span></div>
          <h1 className="max-w-[640px] font-serif text-[34px] leading-[1.14] tracking-[-0.025em] text-[var(--text)] sm:text-[42px]">
            Good {timeOfDay()}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-3 max-w-[480px] font-serif text-[16px] leading-[1.6] text-[var(--text-muted-strong)] sm:text-[17px]">
            What would you like to think through? Write, analyse, build — your keys, your context, your workspace.
          </p>
        </div>

        <div className="mt-7 animate-slide-up sm:mt-8" style={{ animationDelay: "60ms" }}>
          <Composer key={composerKey} onSend={onSend} streaming={streaming} onStop={onStop} initialText={starter} />
          <p className="mt-2 text-center text-[10.5px] leading-relaxed text-[var(--text-muted)]">HelioVision.Ai can make mistakes. Please double-check responses. <span className="hidden sm:inline">Your keys and chats stay on this device.</span></p>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {suggestions.map((suggestion, index) => {
            const Icon = icons[index] ?? Sparkles;
            return (
              <button key={suggestion.label} onClick={() => usePrompt(suggestion.prompt)} className="group flex min-h-[34px] items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1.5 text-[11.5px] text-[var(--text-muted-strong)] shadow-[0_1px_1px_rgba(31,30,29,.02)] transition-all duration-150 hover:border-[var(--border)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">
                <Icon size={12.5} strokeWidth={1.5} className="text-[var(--accent-text)] opacity-80" /> {suggestion.label}
              </button>
            );
          })}
        </div>

        {!hasProvider ? (
          <div className="mt-7 flex flex-col gap-3 rounded-[14px] border border-[color-mix(in_srgb,var(--accent)_26%,transparent)] bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))] p-4 sm:flex-row sm:items-center">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)]"><SunMark size={18} /></span>
            <div className="min-w-0 flex-1"><div className="text-[12.5px] font-[500]">Bring your own model</div><p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--text-muted-strong)]">Add your first provider to use your own keys, or explore the whole workspace with Demo.</p></div>
            <div className="flex shrink-0 gap-2"><button onClick={onAddProvider} className="hv-btn hv-btn-primary !h-8 text-[11.5px]">Add provider</button><button onClick={onDemo} className="hv-btn hv-btn-secondary !h-8 text-[11.5px]">{demoSelected ? "Demo active" : "Try the Demo"}</button></div>
          </div>
        ) : (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10.5px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5"><span className="size-[5px] rounded-full bg-[var(--success)]" /> Provider ready</span>
            <button onClick={onProject} className="flex items-center gap-1.5 hover:text-[var(--text)]"><FolderClosed size={11} strokeWidth={1.5} /> {projects.length} projects</button>
            <span className="flex items-center gap-1.5"><Pencil size={11} strokeWidth={1.5} /> {chatCount} conversations saved locally</span>
            <span className="flex items-center gap-1.5"><Sparkles size={11} strokeWidth={1.5} /> Demo model available</span>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageItem({
  message, streaming, error, editing, setEditing, onSaveEdit, onCopy, onFeedback, onRetry, onDelete, models, onPreview,
}: {
  message: Message;
  streaming: boolean;
  error: { message: string; hint?: string } | null;
  editing: { id: string; text: string } | null;
  setEditing: (value: { id: string; text: string } | null) => void;
  onSaveEdit: () => void;
  onCopy: () => void;
  onFeedback: (value: "up" | "down") => void;
  onRetry: (modelId?: string) => void;
  onDelete: () => void;
  models: { id: string; name: string; description: string }[];
  onPreview: (file: GeneratedFile) => void;
}) {
  const [copied, setCopied] = useState(false);
  if (message.role === "user") {
    return (
      <div className="group flex flex-col items-end" id={message.id}>
        {editing ? (
          <div className="w-full max-w-[88%] rounded-[16px] border border-[var(--accent)] bg-[var(--surface)] p-2 shadow-[var(--shadow-sm)]">
            <textarea autoFocus value={editing.text} onChange={(e) => setEditing({ id: message.id, text: e.target.value })} rows={3} className="w-full resize-none bg-transparent p-2 text-[14.5px] leading-relaxed outline-none" />
            <div className="flex justify-end gap-1.5"><button onClick={() => setEditing(null)} className="hv-btn hv-btn-ghost !h-7 !text-[11px]">Cancel</button><button onClick={onSaveEdit} className="hv-btn hv-btn-primary !h-7 !text-[11px]">Save & rerun</button></div>
          </div>
        ) : (
          <div className="max-w-[84%] rounded-[18px] rounded-br-[5px] bg-[var(--user-bubble)] px-4 py-2.5 text-[14.5px] leading-[1.58] text-[var(--text)]">
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {message.attachments.map((attachment) => (
                  <span key={attachment.id} className="flex max-w-[220px] items-center gap-1.5 rounded-md border border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] px-2 py-1 text-[10.5px] text-[var(--text-muted-strong)]">
                    {attachment.type.startsWith("image/") ? <ImageIcon size={11} /> : <Paperclip size={11} />}<span className="truncate">{attachment.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {!editing && (
          <div className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Tip label="Copy message"><button onClick={onCopy} className="hv-icon-btn !size-7"><Copy size={12.5} strokeWidth={1.5} /></button></Tip>
            <Tip label="Edit and rerun"><button onClick={() => setEditing({ id: message.id, text: message.content })} className="hv-icon-btn !size-7"><Pencil size={12.5} strokeWidth={1.5} /></button></Tip>
            <Tip label="Delete from here"><button onClick={onDelete} className="hv-icon-btn !size-7"><Trash2 size={12.5} strokeWidth={1.5} /></button></Tip>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="group" id={message.id}>
      <div className="mb-2.5 flex items-center gap-2 font-sans text-[10.5px] text-[var(--text-muted)]">
        <span className="flex size-5 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)]"><SunMark size={12} /></span>
        <span className="font-medium uppercase tracking-[0.08em]">HelioVision</span>
        {message.files && message.files.length > 0 && <span className="flex items-center gap-1 text-[9.5px] text-[var(--success)]"><span className="size-[4px] rounded-full bg-[var(--success)]" /> File generated</span>}
      </div>
      {message.reasoning && <ThinkingBlock text={message.reasoning} duration={message.thinkingMs} streaming={streaming && !message.content} />}
      {streaming && !message.content && !message.reasoning && (
        <div className="flex items-center gap-2 py-2 font-sans text-[12px] text-[var(--text-muted)]"><span className="animate-pulse-soft text-[var(--accent)]"><SunMark size={16} /></span> Thinking…</div>
      )}
      {message.content && <Markdown content={message.content} streaming={streaming} />}
      {message.files?.map((file) => <FileCard key={file.id} file={file} onPreview={onPreview} />)}
      {error && (
        <div className="my-3 flex items-start gap-3 rounded-[10px] border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_5%,transparent)] p-3 font-sans">
          <CircleAlert size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-[var(--danger)]" />
          <div className="min-w-0 flex-1"><p className="text-[12.5px] font-[450] text-[var(--text)]">{error.message}</p>{error.hint && <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted-strong)]">{error.hint}</p>}</div>
          <button onClick={() => onRetry()} className="hv-btn hv-btn-secondary !h-7 shrink-0 !text-[11px]"><RotateCcw size={11} /> Retry</button>
        </div>
      )}
      {!streaming && (message.content || error) && (
        <div className="mt-3 flex flex-wrap items-center gap-0.5 font-sans">
          <Tip label="Copy response"><button onClick={async () => { await navigator.clipboard.writeText(message.content); setCopied(true); window.setTimeout(() => setCopied(false), 1400); onCopy(); }} className="hv-icon-btn !size-7">{copied ? <Check size={13} strokeWidth={1.5} className="text-[var(--success)]" /> : <Copy size={13} strokeWidth={1.5} />}</button></Tip>
          <Tip label="Good response"><button onClick={() => onFeedback("up")} className={`hv-icon-btn !size-7 ${message.feedback === "up" ? "!text-[var(--accent-text)]" : ""}`}><ThumbsUp size={13} strokeWidth={1.5} /></button></Tip>
          <Tip label="Needs improvement"><button onClick={() => onFeedback("down")} className={`hv-icon-btn !size-7 ${message.feedback === "down" ? "!text-[var(--accent-text)]" : ""}`}><ThumbsDown size={13} strokeWidth={1.5} /></button></Tip>
          <Menu className="hv-icon-btn !size-7" contentClassName="w-[240px]" trigger={<RefreshCw size={13} strokeWidth={1.5} />}>
            <MenuItem icon={<RotateCcw size={14} />} onSelect={() => onRetry()}>Retry same model</MenuItem>
            <MenuSeparator />
            <div className="px-2 py-1 text-[9.5px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Retry with</div>
            {models.slice(0, 8).map((model) => <MenuItem key={model.id} icon={<Sparkles size={13} />} onSelect={() => onRetry(model.id)}>{model.name}</MenuItem>)}
          </Menu>
          <span className="mx-1 h-3 w-px bg-[var(--border)]" />
          <span className="text-[10.5px] text-[var(--text-muted)]">{message.model ?? "Helio Demo"}{message.providerName ? ` · ${message.providerName}` : ""}</span>
          {message.thinkingMs ? <span className="hidden text-[10.5px] text-[var(--text-muted)] sm:inline"> · thought for {Math.max(1, Math.round(message.thinkingMs / 1000))}s</span> : null}
        </div>
      )}
    </div>
  );
}
