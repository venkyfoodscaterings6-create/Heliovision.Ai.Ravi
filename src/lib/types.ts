export const BRAND = "HelioVision.Ai";

export type Theme = "light" | "dark" | "system";
export type Page = "chat" | "chats" | "projects" | "files";
export type ProviderType = "openai" | "anthropic" | "gemini";
export type ProviderStatus = "untested" | "connected" | "error";
export type FileFormat = "xlsx" | "csv" | "docx" | "pdf" | "html" | "md" | "json" | "txt";
export type Role = "user" | "assistant";

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  keyMasked: string;
  headers: { key: string; value: string }[];
  status: ProviderStatus;
  enabled: boolean;
  useProxy: boolean;
  createdAt: number;
}

export interface AIModel {
  id: string;
  providerId: string;
  modelId: string;
  name: string;
  description: string;
  capabilities: { vision: boolean; reasoning: boolean; files: boolean };
  maxOutputTokens?: number;
  enabled: boolean;
  isDefault?: boolean;
  sort: number;
  isDemo?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  text?: string;
}

export interface GeneratedFile {
  id: string;
  name: string;
  format: FileFormat;
  content: string;
  createdAt: number;
  chatId?: string;
  size?: number;
}

export interface Message {
  id: string;
  chatId: string;
  role: Role;
  content: string;
  reasoning?: string;
  thinkingMs?: number;
  providerId?: string;
  providerName?: string;
  model?: string;
  attachments?: Attachment[];
  files?: GeneratedFile[];
  feedback?: "up" | "down";
  createdAt: number;
}

export interface Chat {
  id: string;
  title: string;
  starred: boolean;
  projectId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  instructions: string;
  files: string[];
  color: string;
  createdAt: number;
  updatedAt: number;
}

export interface GeneralSettings {
  name: string;
  plan: string;
  language: string;
  theme: Theme;
  fontSize: "compact" | "default" | "large";
  chatFont: "default" | "sans" | "serif" | "dyslexic";
  enabledFormats: FileFormat[];
  defaultFormat: FileFormat | "none";
  fileNamePattern: string;
  keysLocked: boolean;
}

export interface Toast {
  id: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

export interface NewProviderDraft {
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  headers: { key: string; value: string }[];
  useProxy: boolean;
}
