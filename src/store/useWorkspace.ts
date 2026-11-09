import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AIModel,
  Chat,
  GeneratedFile,
  GeneralSettings,
  Message,
  NewProviderDraft,
  Page,
  Project,
  Provider,
  Theme,
  Toast,
} from "../lib/types";
import { DEMO_MODEL, seedChats, seedFiles, seedMessages, seedModels, seedProjects, seedProviders, seedSettings, uid } from "../lib/seed";

interface WorkspaceState {
  hydrated: boolean;
  signedIn: boolean;
  page: Page;
  sidebarCollapsed: boolean;
  currentChatId: string | null;
  selectedModelId: string;
  providers: Provider[];
  models: AIModel[];
  chats: Chat[];
  messages: Message[];
  projects: Project[];
  files: GeneratedFile[];
  settings: GeneralSettings;
  toasts: Toast[];
  commandOpen: boolean;
  settingsOpen: boolean;
  settingsTab: string;
  authName: string;

  setPage: (page: Page) => void;
  newChat: () => void;
  openChat: (id: string) => void;
  addChat: (chat: Chat) => void;
  updateChat: (id: string, patch: Partial<Chat>) => void;
  deleteChat: (id: string) => void;
  restoreChats: (chats: Chat[], messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, patch: Partial<Message>) => void;
  removeMessagesFrom: (chatId: string, messageId: string) => void;
  deleteChatMessages: (chatId: string) => void;

  addProvider: (draft: NewProviderDraft) => string;
  updateProvider: (id: string, patch: Partial<Provider>) => void;
  removeProvider: (id: string) => void;
  addModel: (model: AIModel) => void;
  updateModel: (id: string, patch: Partial<AIModel>) => void;
  removeModel: (id: string) => void;
  selectModel: (id: string) => void;
  setDefaultModel: (id: string) => void;

  addProject: (project: Project) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  removeProject: (id: string) => void;
  addFile: (file: GeneratedFile) => void;
  removeFile: (id: string) => void;

  updateSettings: (patch: Partial<GeneralSettings>) => void;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setCommandOpen: (open: boolean) => void;
  openSettings: (tab?: string) => void;
  closeSettings: () => void;
  toast: (message: string, action?: Toast["action"]) => void;
  dismissToast: (id: string) => void;
  lockWorkspace: () => void;
  clearProviderKeys: () => void;
  restoreProviderKeys: (keys: Record<string, string>) => void;
  unlockWorkspace: () => void;
  setAuthName: (name: string) => void;
  importWorkspace: (data: Partial<WorkspaceState>) => void;
  resetWorkspace: () => void;
}

const baseSeed = {
  providers: seedProviders,
  models: seedModels,
  chats: seedChats,
  messages: seedMessages,
  projects: seedProjects,
  files: seedFiles,
  settings: seedSettings,
};

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      signedIn: true,
      page: "chat",
      sidebarCollapsed: false,
      currentChatId: null,
      selectedModelId: DEMO_MODEL.id,
      authName: "Alex Morgan",
      ...baseSeed,
      toasts: [],
      commandOpen: false,
      settingsOpen: false,
      settingsTab: "general",

      setPage: (page) => set({ page }),
      newChat: () => set({ page: "chat", currentChatId: null }),
      openChat: (id) => set({ page: "chat", currentChatId: id }),
      addChat: (chat) => set((s) => ({ chats: [chat, ...s.chats] })),
      updateChat: (id, patch) =>
        set((s) => ({
          chats: s.chats.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)),
        })),
      deleteChat: (id) =>
        set((s) => ({
          chats: s.chats.filter((c) => c.id !== id),
          messages: s.messages.filter((m) => m.chatId !== id),
          files: s.files.filter((f) => f.chatId !== id),
          currentChatId: s.currentChatId === id ? null : s.currentChatId,
        })),
      restoreChats: (chats, messages) =>
        set((s) => ({ chats: [...chats.filter((c) => !s.chats.some((x) => x.id === c.id)), ...s.chats], messages: [...messages.filter((m) => !s.messages.some((x) => x.id === m.id)), ...s.messages] })),
      addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
      updateMessage: (id, patch) => set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      removeMessagesFrom: (chatId, messageId) =>
        set((s) => {
          const all = s.messages.filter((m) => m.chatId === chatId);
          const idx = all.findIndex((m) => m.id === messageId);
          if (idx < 0) return s;
          const removeIds = new Set(all.slice(idx).map((m) => m.id));
          return { messages: s.messages.filter((m) => !removeIds.has(m.id)) };
        }),
      deleteChatMessages: (chatId) => set((s) => ({ messages: s.messages.filter((m) => m.chatId !== chatId) })),

      addProvider: (draft) => {
        const id = uid("provider");
        const provider: Provider = {
          ...draft,
          id,
          keyMasked: draft.apiKey ? `••••••••••••${draft.apiKey.slice(-4)}` : draft.baseUrl.includes("localhost") ? "No key" : "Not set",
          apiKey: draft.apiKey,
          status: "untested",
          enabled: true,
          createdAt: Date.now(),
        };
        set((s) => ({ providers: [...s.providers, provider] }));
        return id;
      },
      updateProvider: (id, patch) =>
        set((s) => ({
          providers: s.providers.map((p) =>
            p.id === id
              ? { ...p, ...patch, keyMasked: patch.apiKey ? `••••••••••••${patch.apiKey.slice(-4)}` : p.keyMasked }
              : p,
          ),
        })),
      removeProvider: (id) =>
        set((s) => ({
          providers: s.providers.filter((p) => p.id !== id),
          models: s.models.filter((m) => m.providerId !== id),
        })),
      addModel: (model) => set((s) => ({ models: [...s.models, model] })),
      updateModel: (id, patch) => set((s) => ({ models: s.models.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      removeModel: (id) => set((s) => ({ models: s.models.filter((m) => m.id !== id) })),
      selectModel: (id) => {
        localStorage.setItem("hv_selected_model", id);
        set({ selectedModelId: id });
      },
      setDefaultModel: (id) =>
        set((s) => ({ models: s.models.map((m) => ({ ...m, isDefault: m.id === id })), selectedModelId: s.selectedModelId })),

      addProject: (project) => set((s) => ({ projects: [project, ...s.projects] })),
      updateProject: (id, patch) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)) })),
      removeProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          chats: s.chats.map((c) => (c.projectId === id ? { ...c, projectId: undefined } : c)),
        })),
      addFile: (file) => set((s) => ({ files: [file, ...s.files.filter((f) => f.id !== file.id)] })),
      removeFile: (id) => set((s) => ({ files: s.files.filter((f) => f.id !== id) })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setTheme: (theme) => set((s) => ({ settings: { ...s.settings, theme } })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      openSettings: (settingsTab = "general") => set({ settingsOpen: true, settingsTab }),
      closeSettings: () => set({ settingsOpen: false }),
      toast: (message, action) => {
        const id = uid("toast");
        set((s) => ({ toasts: [...s.toasts, { id, message, action }] }));
        window.setTimeout(() => {
          const current = get().toasts.find((t) => t.id === id);
          if (current) set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
        }, 4200);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      lockWorkspace: () => set({ signedIn: false }),
      clearProviderKeys: () =>
        set((s) => ({ providers: s.providers.map((p) => (p.apiKey ? { ...p, apiKey: "" } : p)) })),
      restoreProviderKeys: (keys) =>
        set((s) => ({ providers: s.providers.map((p) => keys[p.id] ? { ...p, apiKey: keys[p.id], keyMasked: `••••••••••••${keys[p.id].slice(-4)}` } : p) })),
      unlockWorkspace: () => set({ signedIn: true }),
      setAuthName: (authName) => set({ authName }),
      importWorkspace: (data) =>
        set((s) => ({
          providers: data.providers ?? s.providers,
          models: data.models ?? s.models,
          chats: data.chats ?? s.chats,
          messages: data.messages ?? s.messages,
          projects: data.projects ?? s.projects,
          files: data.files ?? s.files,
          settings: data.settings ?? s.settings,
          selectedModelId: data.selectedModelId ?? s.selectedModelId,
        })),
      resetWorkspace: () =>
        set({
          providers: [],
          models: [DEMO_MODEL],
          chats: [],
          messages: [],
          projects: [],
          files: [],
          selectedModelId: DEMO_MODEL.id,
          currentChatId: null,
          page: "chat",
        }),
    }),
    {
      name: "heliovision_workspace_v1",
      version: 1,
      partialize: (state) => ({
        signedIn: state.signedIn,
        page: state.page,
        sidebarCollapsed: state.sidebarCollapsed,
        currentChatId: state.currentChatId,
        selectedModelId: state.selectedModelId,
        providers: state.providers,
        models: state.models,
        chats: state.chats,
        messages: state.messages,
        projects: state.projects,
        files: state.files,
        settings: state.settings,
        authName: state.authName,
      }),
      onRehydrateStorage: () => (state) => {
        state?.hydrated;
      },
    },
  ),
);

// Persist the selected model separately for fast boot and for an uncluttered storage inspection.
useWorkspace.subscribe((state) => {
  localStorage.setItem("hv_selected_model", state.selectedModelId);
  localStorage.setItem("hv_sidebar", String(state.sidebarCollapsed));
});
