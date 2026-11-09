/**
 * Dexie schema for the optional structured local store.
 *
 * The interface keeps a fast, reactive Zustand cache persisted to this browser.
 * This versioned database mirrors all core resources for portable, queryable
 * local storage and future migrations. Nothing is ever sent to a backend.
 */
import Dexie, { type Table } from "dexie";
import type { AIModel, Chat, GeneratedFile, Message, Project, Provider } from "./types";

export interface SettingRow { key: string; value: unknown; updatedAt: number; }

export class HelioVisionDatabase extends Dexie {
  providers!: Table<Provider, string>;
  models!: Table<AIModel, string>;
  chats!: Table<Chat, string>;
  messages!: Table<Message, string>;
  projects!: Table<Project, string>;
  files!: Table<GeneratedFile, string>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super("heliovision_local");
    this.version(1).stores({
      providers: "id, name, type, status, enabled, createdAt",
      models: "id, providerId, modelId, enabled, sort",
      chats: "id, title, starred, projectId, createdAt, updatedAt",
      messages: "id, chatId, role, createdAt, [chatId+createdAt]",
      projects: "id, name, createdAt, updatedAt",
      files: "id, format, chatId, createdAt",
      settings: "key",
    });
  }
}

export const db = new HelioVisionDatabase();

export async function mirrorWorkspace(snapshot: {
  providers: Provider[]; models: AIModel[]; chats: Chat[]; messages: Message[];
  projects: Project[]; files: GeneratedFile[]; settings: Record<string, unknown>;
}) {
  if (typeof indexedDB === "undefined") return;
  try {
    await db.transaction("rw", [db.providers, db.models, db.chats, db.messages, db.projects, db.files, db.settings], async () => {
      await Promise.all([
        db.providers.clear(), db.models.clear(), db.chats.clear(), db.messages.clear(), db.projects.clear(), db.files.clear(), db.settings.clear(),
      ]);
      await Promise.all([
        db.providers.bulkPut(snapshot.providers),
        db.models.bulkPut(snapshot.models),
        db.chats.bulkPut(snapshot.chats),
        db.messages.bulkPut(snapshot.messages),
        db.projects.bulkPut(snapshot.projects),
        db.files.bulkPut(snapshot.files),
        db.settings.bulkPut(Object.entries(snapshot.settings).map(([key, value]) => ({ key, value, updatedAt: Date.now() }))),
      ]);
    });
  } catch {
    // IndexedDB can be unavailable in private modes. Zustand persistence remains.
  }
}
