import type { AIModel, Attachment, Provider } from "./types";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
}

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "usage"; inputTokens?: number; outputTokens?: number }
  | { type: "done" }
  | { type: "error"; error: string; code?: "auth" | "rate_limit" | "model" | "cors" | "network" | "unknown" };

export interface StreamOptions {
  provider: Provider;
  model: AIModel;
  turns: ChatTurn[];
  system: string;
  signal: AbortSignal;
  onEvent: (event: StreamEvent) => void;
  webSearch?: boolean;
  thinking?: boolean;
}

export const DEFAULT_BASE_URLS: Record<Provider["type"], string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
};

export function friendlyError(status: number, detail: string): StreamEvent {
  const low = detail.toLowerCase();
  if (status === 401 || status === 403 || low.includes("api key") || low.includes("unauthorized")) {
    return { type: "error", error: "The provider rejected this API key. Check it in Settings → Models & Providers.", code: "auth" };
  }
  if (status === 429) return { type: "error", error: "The provider is rate-limiting this key. Wait a moment, then retry.", code: "rate_limit" };
  if (status === 404 || low.includes("model not found") || low.includes("does not exist")) {
    return { type: "error", error: "This model was not found at the provider. Confirm its exact model ID in Settings.", code: "model" };
  }
  if (low.includes("cors") || low.includes("failed to fetch") || low.includes("networkerror")) {
    return { type: "error", error: "The browser could not reach this provider. It may block direct requests (CORS). Enable ‘Route through proxy’ in provider settings.", code: "cors" };
  }
  if (low.includes("insufficient") || low.includes("credit") || low.includes("quota")) {
    return { type: "error", error: "This API key has no remaining quota or credit at the provider.", code: "auth" };
  }
  return { type: "error", error: detail.slice(0, 300) || `The provider returned an error (${status}).`, code: "unknown" };
}

function endpoint(): string {
  return "/api/proxy";
}

function proxyBody(url: string, init: RequestInit) {
  return JSON.stringify({ url, method: init.method ?? "POST", headers: init.headers, body: init.body });
}

async function consumeSse(response: Response, onData: (data: string, event?: string) => void, signal: AbortSignal) {
  if (!response.body) throw new Error("The provider returned an empty stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (signal.aborted) { await reader.cancel(); return; }
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        let event = "";
        const dataLines: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (dataLines.length) onData(dataLines.join("\n"), event);
      }
    }
    // Flush a final event if the stream did not end with a blank line.
    const tail = buffer.trim();
    if (tail) {
      const dataLines = tail.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
      if (dataLines.length) onData(dataLines.join("\n"));
    }
  } finally {
    reader.releaseLock();
  }
}

function imageParts(attachments?: Attachment[]) {
  return (attachments ?? []).filter((a) => a.dataUrl && a.type.startsWith("image/"));
}

function fileText(attachments?: Attachment[]) {
  return (attachments ?? []).filter((a) => a.text).map((a) => `\n\n--- Attached file: ${a.name} ---\n${a.text}`).join("");
}

async function runOpenAi(opts: StreamOptions) {
  const { provider, model, turns, system, signal, onEvent, thinking, webSearch } = opts;
  const base = provider.baseUrl.replace(/\/+$/, "");
  const target = `${base}${/\/chat\/completions$/.test(base) ? "" : "/chat/completions"}`;
  const messages = [
    { role: "system", content: system },
    ...turns.map((turn) => {
      const images = imageParts(turn.attachments);
      const text = turn.content + fileText(turn.attachments);
      if (images.length) {
        return { role: turn.role, content: [{ type: "text", text }, ...images.map((image) => ({ type: "image_url", image_url: { url: image.dataUrl } }))] };
      }
      return { role: turn.role, content: text };
    }),
  ];
  const body: Record<string, unknown> = { model: model.modelId, messages, stream: true, ...(model.maxOutputTokens ? { max_tokens: model.maxOutputTokens } : {}) };
  if (thinking && model.capabilities.reasoning) {
    body.reasoning_effort = "medium";
    body.include_reasoning = true;
  }
  if (webSearch) body.plugins = [{ id: "web" }];
  const headers: Record<string, string> = { "Content-Type": "application/json", ...Object.fromEntries(provider.headers.filter((h) => h.key).map((h) => [h.key, h.value])) };
  if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;
  const init: RequestInit = { method: "POST", headers, body: JSON.stringify(body), signal };
  let response: Response;
  if (provider.useProxy) {
    response = await fetch(endpoint(), { method: "POST", headers: { "Content-Type": "application/json" }, body: proxyBody(target, init), signal });
  } else {
    response = await fetch(target, init);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    onEvent(friendlyError(response.status, detail));
    return;
  }
  await consumeSse(response, (data) => {
    if (data === "[DONE]") { onEvent({ type: "done" }); return; }
    try {
      const json = JSON.parse(data);
      const delta = json.choices?.[0]?.delta;
      if (delta?.reasoning || delta?.reasoning_content) onEvent({ type: "reasoning", text: delta.reasoning ?? delta.reasoning_content });
      if (delta?.content) onEvent({ type: "text", text: delta.content });
      if (json.usage) onEvent({ type: "usage", inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens });
    } catch { /* Keep-alive or non-JSON line. */ }
  }, signal);
  onEvent({ type: "done" });
}

async function runAnthropic(opts: StreamOptions) {
  const { provider, model, turns, system, signal, onEvent, thinking } = opts;
  const base = provider.baseUrl.replace(/\/+$/, "");
  const target = `${base}${/\/v1\/messages$/.test(base) ? "" : "/v1/messages"}`;
  const body: Record<string, unknown> = {
    model: model.modelId,
    max_tokens: model.maxOutputTokens ?? 4096,
    system,
    stream: true,
    messages: turns.map((turn) => {
      const images = imageParts(turn.attachments);
      const text = turn.content + fileText(turn.attachments);
      return { role: turn.role, content: images.length ? [{ type: "text", text }, ...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.type, data: i.dataUrl!.split(",")[1] } }))] : text };
    }),
  };
  if (thinking && model.capabilities.reasoning) body.thinking = { type: "enabled", budget_tokens: 2048 };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": provider.apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
    ...Object.fromEntries(provider.headers.filter((h) => h.key).map((h) => [h.key, h.value])),
  };
  const init: RequestInit = { method: "POST", headers, body: JSON.stringify(body), signal };
  const response = provider.useProxy
    ? await fetch(endpoint(), { method: "POST", headers: { "Content-Type": "application/json" }, body: proxyBody(target, init), signal })
    : await fetch(target, init);
  if (!response.ok) {
    onEvent(friendlyError(response.status, await response.text().catch(() => "")));
    return;
  }
  await consumeSse(response, (data, event) => {
    if (data === "[DONE]") return;
    try {
      const json = JSON.parse(data);
      if (json.type === "content_block_delta") {
        if (json.delta?.type === "text_delta") onEvent({ type: "text", text: json.delta.text });
        if (json.delta?.type === "thinking_delta") onEvent({ type: "reasoning", text: json.delta.thinking });
      }
      if (json.type === "message_delta" && json.usage) onEvent({ type: "usage", inputTokens: json.usage.input_tokens, outputTokens: json.usage.output_tokens });
      if (json.type === "error") onEvent({ type: "error", error: json.error?.message ?? "Anthropic returned an error.", code: "unknown" });
    } catch {
      if (event === "error") onEvent({ type: "error", error: data.slice(0, 240), code: "unknown" });
    }
  }, signal);
  onEvent({ type: "done" });
}

async function runGemini(opts: StreamOptions) {
  const { provider, model, turns, system, signal, onEvent, thinking } = opts;
  const base = provider.baseUrl.replace(/\/+$/, "");
  const path = `${base}/models/${encodeURIComponent(model.modelId)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(provider.apiKey)}`;
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: system }] },
    contents: turns.map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [
        { text: turn.content + fileText(turn.attachments) },
        ...imageParts(turn.attachments).map((image) => ({ inlineData: { mimeType: image.type, data: image.dataUrl!.split(",")[1] } })),
      ],
    })),
    generationConfig: { ...(model.maxOutputTokens ? { maxOutputTokens: model.maxOutputTokens } : {}) },
    ...(thinking && model.capabilities.reasoning ? { generationConfig: { thinkingConfig: { includeThoughts: true, thinkingBudget: 2048 } } } : {}),
  };
  const headers: Record<string, string> = { "Content-Type": "application/json", ...Object.fromEntries(provider.headers.filter((h) => h.key).map((h) => [h.key, h.value])) };
  const init: RequestInit = { method: "POST", headers, body: JSON.stringify(body), signal };
  const response = provider.useProxy
    ? await fetch(endpoint(), { method: "POST", headers: { "Content-Type": "application/json" }, body: proxyBody(path, init), signal })
    : await fetch(path, init);
  if (!response.ok) {
    onEvent(friendlyError(response.status, await response.text().catch(() => "")));
    return;
  }
  await consumeSse(response, (data) => {
    if (data === "[DONE]") return;
    try {
      const json = JSON.parse(data);
      for (const candidate of json.candidates ?? []) {
        for (const part of candidate.content?.parts ?? []) {
          if (part.thought) onEvent({ type: "reasoning", text: part.text ?? "" });
          else if (part.text) onEvent({ type: "text", text: part.text });
        }
      }
      if (json.usageMetadata) onEvent({ type: "usage", inputTokens: json.usageMetadata.promptTokenCount, outputTokens: json.usageMetadata.candidatesTokenCount });
    } catch { /* Ignore non-JSON keep-alive. */ }
  }, signal);
  onEvent({ type: "done" });
}

export async function streamChat(opts: StreamOptions) {
  if (opts.provider.type === "anthropic") return runAnthropic(opts);
  if (opts.provider.type === "gemini") return runGemini(opts);
  return runOpenAi(opts);
}

export async function fetchProviderModels(provider: Provider): Promise<string[]> {
  const base = provider.baseUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = { ...Object.fromEntries(provider.headers.filter((h) => h.key).map((h) => [h.key, h.value])) };
  if (provider.type === "anthropic") {
    headers["x-api-key"] = provider.apiKey;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  } else if (provider.type === "gemini") {
    headers["x-goog-api-key"] = provider.apiKey;
  } else if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;

  let url = "";
  if (provider.type === "anthropic") url = `${base}/v1/models`;
  else if (provider.type === "gemini") url = `${base}/models`;
  else url = `${base}/models`;

  const init = { method: "GET", headers };
  const response = provider.useProxy
    ? await fetch("/api/proxy", { method: "POST", headers: { "Content-Type": "application/json" }, body: proxyBody(url, init) })
    : await fetch(url, init);
  if (!response.ok) throw new Error(response.status === 401 ? "Invalid API key" : `Provider returned ${response.status}`);
  const json = await response.json();
  const rows = json.data ?? json.models ?? [];
  return rows.map((row: { id?: string; name?: string; displayName?: string }) => row.id ?? row.name ?? row.displayName ?? "").filter(Boolean);
}

export async function testProvider(provider: Provider): Promise<{ ok: boolean; message: string }> {
  try {
    const models = await fetchProviderModels(provider);
    return { ok: true, message: `Connected — ${models.length} model${models.length === 1 ? "" : "s"} available` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not reach this provider" };
  }
}

// A clearly-labelled local preview. It never claims to be a real provider response.
export async function runDemoStream(
  prompt: string,
  _turns: ChatTurn[],
  onEvent: (event: StreamEvent) => void,
  signal: AbortSignal,
  options: { thinking: boolean; webSearch: boolean; formatLabel?: string },
) {
  const wait = (ms: number) => new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
  const low = prompt.toLowerCase();
  const isCode = /\bcode\b|function|typescript|javascript|python|\bsql\b|component|\bbug\b|\bapi\b/.test(low);
  const isData = /revenue|numbers|dataset|\bdata\b|breakdown|analys|analy[sz]e|metrics|kpi|spreadsheet|excel|budget|sales/.test(low);
  const isWrite = /write|draft|email|essay|\bcopy\b|post|story|paragraph/.test(low);
  const isPlan = /plan|roadmap|launch|schedule|week|organis|organiz/.test(low);

  const reasoning = isCode
    ? "The request calls for a concrete implementation rather than a broad survey. I am narrowing the example to the smallest useful interface, then checking edge cases and failure states before writing any code."
    : isWrite
      ? "I am reading for the underlying intent: the user wants something clear and human, not a pile of adjectives. I will lead with a single strong idea, keep one useful example, and end with a next step."
      : isPlan
        ? "First I am separating the outcome from the tasks, then grouping the work by decision rather than by department. The sequence matters more than the perfect checklist: prove the promise, then make it repeatable."
        : "I am mapping the question into its useful parts, choosing the smallest structure that can hold the answer, and checking for assumptions that should be made explicit. The goal is something a person can act on immediately.";

  try {
    if (options.thinking) {
      for (const word of reasoning.split(" ")) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        onEvent({ type: "reasoning", text: word + " " });
        await wait(24);
      }
    }
    onEvent({ type: "reasoning", text: "" });
    await wait(260);
    let content = "";
    if (isData) {
      content = `Here is a clear read on the numbers, followed by the detail you can take into a workbook.

### The short version

Revenue is **£31,770** for the week, up **8.4%**. Growth is concentrated in productised work, which is the healthiest place to see it. Retainers held steady; workshops softened on a single cancelled session.

| Channel | Revenue | Share | Change |
| --- | ---: | ---: | ---: |
| Retainers | £18,400 | 58% | +6.2% |
| Productised work | £8,950 | 28% | +14.8% |
| Workshops | £4,420 | 14% | -3.1% |
| **Total** | **£31,770** | **100%** | **+8.4%** |

### What is actually driving growth

1. **Productised work added about £1,150.** That is repeatable demand rather than a one-off favour, and it is the line I would protect.
2. **Retainers rose 6.2%,** roughly in line with the two extra delivery days. There is no meaningful price movement hiding in the total.
3. **Workshops are not in decline.** A single cancellation accounts for almost all of the £140 decrease.

### The one risk to watch

The top two clients now represent an estimated **41% of revenue**. That is not alarming yet, but it deserves a monthly check. A useful guardrail: no single client above 20%, and no channel above 60% of the total.

**Suggested next step:** send the productised-work waitlist a small December cohort offer while demand is still warm. I have attached a workbook with this table ready to use.`;
    } else if (isCode) {
      content = `A clean implementation is mostly a question of making the failure states impossible to ignore.

### A small, resilient version

\`\`\`typescript
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function request<T>(
  url: string,
  signal?: AbortSignal,
): Promise<Result<T>> {
  try {
    const response = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return { ok: false, error: \`Request failed (\${response.status})\` };
    }

    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    if (signal?.aborted) return { ok: false, error: "Cancelled" };
    return { ok: false, error: "Network unavailable" };
  }
}
\`\`\`

**Why this shape works**

- The caller can never forget to check an error.
- Aborting is treated as a normal outcome, not an exception.
- The network boundary is the only place that knows about status codes.

If you share your current function, I can adapt this to its exact types and add tests around the failure paths.`;
    } else if (isWrite) {
      content = `Here is a first pass — warm, specific and free of throat-clearing.

## A note worth sending

> Hi Maya,
>
> I have been thinking about what made last week work. It was not the new tooling or the extra planning. It was that everyone knew the one decision in front of them.
>
> So I have made a small change. From Monday, our weekly note will answer three questions: what moved, what is stuck, and what needs a decision. Nothing else.
>
> It should take four minutes to read and leave us with a clearer week. Tell me if it lands well — or if we should make it shorter still.

**What is doing the work**

- The opening names a shared observation instead of announcing a process.
- The change is concrete and small enough to believe.
- It ends with a question, not a request for approval.

**One optional edit:** *"leave us with a clearer week"* could become *"leave us with a calmer Monday."* That is more vivid, but slightly less precise. I would keep the first version for a colleague and use the second for a wider audience.`;
    } else if (isPlan) {
      content = `Let's turn this into a plan that survives contact with a real week.

### The shape

| Phase | Focus | What good looks like | Time |
| --- | --- | --- | --- |
| 1 · Prove | One audience, one promise | Five conversations with the right people | Days 1–3 |
| 2 · Build | The smallest complete version | The promise delivered end to end | Days 4–10 |
| 3 · Invite | A controlled first release | 20 engaged users, clear feedback | Days 11–14 |
| 4 · Learn | Decide what to keep | A written decision, not a vibe | Day 15 |

### Start here

1. **Write the promise in one sentence.** If it takes a paragraph, the launch is still a hypothesis.
2. **Choose the first twenty people by name.** A launch to "everyone" teaches you very little.
3. **Build the proof, not the polish.** A clear before-and-after beats three extra onboarding screens.
4. **Schedule the decision.** Put a 45-minute review on day 15 before the work begins.

> The real risk is not launching late. It is launching something that nobody can describe in one sentence.

**Next step:** give me the audience and the promised outcome, and I will turn this into a dated checklist you can export.`;
    } else {
      content = `Here's a useful way to approach it.

### The short answer

Start with the decision you want to make, then work backwards to the smallest piece of evidence that would change it. It is easy to collect more information; it is harder to be clear about what would make you act differently.

| What | Why it matters | First move |
| --- | --- | --- |
| The outcome | Keeps the work honest | Write it in one sentence |
| The constraint | Makes trade-offs visible | Name the real limit |
| The evidence | Stops confident guessing | Pick one measurable signal |
| The next step | Turns thinking into momentum | Put it on the calendar |

### A practical sequence

- **Clarify the goal** in language a smart outsider would understand.
- **List the assumptions** that must be true. Rank them by risk.
- **Test the riskiest one first** — not the easiest one.
- **Write down what you learned** while the context is still fresh.

> A good decision is not the one with the most research behind it. It is the one where you have been honest about what you do not yet know.

If you share a little more context, I can make this specific — including a downloadable brief in whichever format you need.`;
    }

    if (options.webSearch) {
      content += `\n\n---\n\n**Note:** Web search is not available in Demo mode. Configure a provider that supports it to search live sources.`;
    }
    const words = content.split(/(\s+)/);
    for (const chunk of words) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      onEvent({ type: "text", text: chunk });
      await wait(chunk.trim() ? 8 + Math.random() * 14 : 4);
    }
    onEvent({ type: "usage", inputTokens: Math.max(42, Math.round(prompt.length / 3.6)), outputTokens: Math.round(content.length / 3.8) });
    onEvent({ type: "done" });
  } catch (error) {
    if (!signal.aborted && error instanceof Error) onEvent({ type: "error", error: "The demo stream stopped unexpectedly.", code: "unknown" });
  }
}

export function modelSupportsSearch(model: AIModel): boolean {
  return !model.isDemo && (model.providerId === "provider_openrouter" || model.providerId === "provider_anthropic") && /gpt|claude|gemini/i.test(model.modelId);
}
