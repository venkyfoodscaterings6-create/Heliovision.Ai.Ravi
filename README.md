# HelioVision.Ai

A private, local-first, multi-provider AI workspace. HelioVision.Ai brings your own models and API keys into one calm interface: conversations, projects, generated files, search, thinking, and real exports — with no accounts, no telemetry and no server-side storage.

> The interface is inspired by the clarity and warmth of modern chat tools. The HelioVision.Ai name, sun-spark mark, copy and visual system are original.

## Quick start

```bash
npm ci
npm run dev          # http://localhost:5173
npm run typecheck
npm test
npm run build        # production build into dist/
npm run preview      # preview the production build
```

Requirements: Node.js `^20.19.0` or `>=22.12.0` and npm. The app is a static React/Vite build; every chat, key and file stays in your browser.

## What is included

- **Warm light / dark / system themes**, all driven by CSS tokens in `src/index.css`.
- **Local-first workspace**: seeded with realistic demo data on first load, then persisted automatically.
- **Chat experience**: streaming replies, Stop, retry with a different model, edit-and-rerun, feedback, collapsible thinking, code blocks with copy, tables, attachments, output-format chips, drag/paste uploads and a floating scroll-to-bottom control.
- **Providers** (Settings → Models & Providers): unlimited OpenAI-compatible, Anthropic and Gemini providers; custom base URLs, masked keys, custom headers, connection tests, model discovery and manual models with capability flags. Demo mode is clearly labelled and needs no key.
- **Real file exports** generated entirely in the browser: Excel (one sheet per markdown table, frozen styled header, numeric cells), CSV, Word, PDF, HTML (self-contained), Markdown, JSON and plain text. Files appear as cards, open in a resizable Preview/Code panel and are collected on the Files page.
- **Chats, Projects and Files pages** with search, multi-select deletion, star/move/rename, project instructions, previews and undo toasts.
- **Settings**: general profile and language, appearance with theme previews and chat fonts (including Lexend), providers and models, output formats and file-name patterns, data export/import, destructive actions, optional passphrase lock (Web Crypto AES-GCM) and keyboard shortcuts.
- **Command palette** (`⌘K` / `Ctrl+K`) and shortcuts: new chat (`⌘⇧O`), sidebar (`⌘B`), shortcuts (`⌘/`), close (`Esc`).
- **Responsive**: the sidebar becomes an icon rail on desktop and a drawer on mobile; the composer is pinned with safe-area padding; touch targets are at least 40–44 px.
- **Accessibility**: semantic landmarks, labels, tooltips, keyboard menus, a high-contrast accent-text token, reduced-motion support and a live close-on-Escape pattern.

## Architecture

```
src/
  App.tsx                 shell, theme synchronisation, auth/lock screen, shortcuts, Dexie mirror
  index.css               design tokens, typography, base components, markdown + code styling
  store/useWorkspace.ts   Zustand store (persisted): chats, messages, providers, models, projects, files, settings
  lib/
    types.ts              shared domain types
    seed.ts               realistic first-run data and demo model
    adapters.ts           OpenAI-compatible / Anthropic / Gemini streaming adapters + Demo stream
    formats.ts            output-format detection, markdown table parsing, XLSX/DOCX/PDF/CSV/HTML/JSON generation
    db.ts                 versioned Dexie schema and reactive mirror
    crypto.ts             PBKDF2 + AES-GCM helpers
    keyVault.ts           optional local encrypted key vault
    *.test.ts             Vitest suites
  components/             Sidebar, Composer, ChatView, Markdown, FileCard, Pages, Settings, ProviderSettings,
                          CommandPalette, Toasts, shared UI primitives
api/proxy.ts              optional Vercel edge proxy for CORS-blocked providers
vercel.json               Vercel deploy configuration and security headers
```

### Persistence

The reactive workspace is persisted with Zustand to `localStorage` and mirrored into a versioned IndexedDB database (`heliovision_local`, Dexie tables: `providers`, `models`, `chats`, `messages`, `projects`, `files`, `settings`). Theme, sidebar state and the selected model are persisted separately. The last open chat is restored on reload.

No account exists and no backend is required. **Log out / Lock workspace** closes the workspace and, when a passphrase vault is enabled, removes decrypted keys from memory.

### Adding a provider

1. Open **Settings → Models & Providers → Add provider**.
2. Choose a type:
   - **OpenAI-compatible** — OpenAI, OpenRouter, Groq, Together, DeepSeek, Mistral, Ollama, LM Studio and similar. Requests go to `POST {baseURL}/chat/completions`; models come from `GET {baseURL}/models`.
   - **Anthropic** — `POST {baseURL}/v1/messages`, `x-api-key`, `anthropic-version` and the direct-browser-access header.
   - **Google Gemini** — `streamGenerateContent?alt=sse` with a query key.
3. Enter the name, base URL and API key. Add optional headers if your provider requires them.
4. Use **Test connection**, then **Save provider**.
5. Use **Fetch models** to select from the provider's model list, or **Manual** to add an exact model ID with display name, description, capability flags and max output tokens.
6. Enable the models you want; only enabled models appear in the composer.

Several providers can share a base URL with different keys (for example “OpenRouter — personal” and “OpenRouter — work”).

### CORS and the optional proxy

Some providers refuse direct browser requests. Each provider has a **Route through proxy** toggle. When enabled, requests are posted to `/api/proxy`, which forwards them to the provider and streams the response back.

The proxy is deliberately narrow:

- accepts only same-origin requests (or same-site requests without an `Origin`);
- only `GET` and `POST`;
- **https targets only**, public hosts only (localhost, private IPv4/IPv6 ranges, `.local` and `.internal` are blocked);
- request bodies are capped at 6 MB and runtime at 55 s;
- no headers, keys, bodies or responses are stored or logged;
- browser-managed headers such as `Host`, `Origin`, `Cookie` and `Connection` cannot be forwarded.

If the proxy is not deployed (for example on a static host), direct requests still work for CORS-friendly providers.

### Deploying to Vercel

Use a Node.js version supported by `package.json` in the Vercel project settings. The checked-in `vercel.json` configures the Vite build, `dist/` output, SPA routing, security headers and the optional `/api/proxy` function. No application environment variables are required.

Before deploying, run the type check, tests and production build:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Then connect the folder to a Vercel project (or install the Vercel CLI and run `vercel` for a preview deployment, followed by `vercel --prod` for production). The proxy is available automatically at `/api/proxy`.

### Privacy model

- API keys are kept in this browser only and are sent to the provider's own base URL (or your proxy).
- No analytics, error tracking, service worker uploads or third-party storage.
- Generated files are produced client-side; downloads are object URLs created and revoked locally.
- Export all chats as one JSON file. Keys are excluded unless you explicitly tick **Include API keys**.
- Passphrase protection uses PBKDF2-SHA-256 (210k iterations) and AES-GCM via Web Crypto. If you lose the passphrase, encrypted keys cannot be recovered.

### Testing

```bash
npm test
```

Coverage includes output-format phrase detection, markdown table parsing, CSV/JSON/HTML rendering, file-name patterns, friendly error mapping, and the OpenAI-compatible, Anthropic and Gemini streaming adapters — including that credentials are sent only to the selected provider host.

## Local-first notes for evaluators

- First load is seeded with a labelled **Helio Demo** model. You can send a message immediately and see streaming, thinking, tables, code, and a real Excel file card with preview/download — no API key required.
- Add a provider and hit **Fetch models** to exercise live discovery. The seeded providers exist as sample cards; replace their keys with your own to make real calls. No keys are included in this repository.
- The **OpenAI-compatible** adapter is the default provider type and works with any compatible endpoint.

## Original design assets

The HelioVision.Ai mark is an inline SVG sun-spark drawn with thin accent rays. Typography: Inter (UI), Source Serif 4 (assistant replies and greeting), JetBrains Mono (code) and Lexend (dyslexia-friendly option), loaded from Google Fonts with `font-display: swap`.
