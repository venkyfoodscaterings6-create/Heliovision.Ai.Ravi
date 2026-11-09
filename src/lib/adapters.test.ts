import { describe, expect, it, vi, afterEach } from "vitest";
import { friendlyError, streamChat, fetchProviderModels, DEFAULT_BASE_URLS } from "./adapters";
import type { AIModel, Provider } from "./types";

const model = (isDemo = false): AIModel => ({
  id: "m1", providerId: "p1", modelId: "test-model", name: "Test", description: "",
  capabilities: { vision: true, reasoning: true, files: true }, enabled: true, sort: 0, isDemo,
});

const provider = (type: Provider["type"] = "openai"): Provider => ({
  id: "p1", name: "Test", type, baseUrl: DEFAULT_BASE_URLS[type], apiKey: "sk-test-1234",
  keyMasked: "••••1234", headers: [], status: "untested", enabled: true, useProxy: false, createdAt: Date.now(),
});

afterEach(() => vi.unstubAllGlobals());

describe("friendly errors", () => {
  const code = (status: number, detail: string) => {
    const event = friendlyError(status, detail) as { type: "error"; error: string; code?: string };
    return event.code;
  };
  const message = (status: number, detail: string) => {
    const event = friendlyError(status, detail) as { type: "error"; error: string };
    return event.error;
  };
  it("maps auth, rate limits, missing models and CORS", () => {
    expect(code(401, "unauthorized")).toBe("auth");
    expect(code(429, "slow down")).toBe("rate_limit");
    expect(code(404, "model not found")).toBe("model");
    expect(code(500, "Failed to fetch")).toBe("cors");
    expect(code(402, "insufficient credit")).toBe("auth");
  });
  it("always provides a human-readable message", () => {
    expect(message(500, "")).toContain("provider");
  });
});

describe("OpenAI-compatible streaming adapter", () => {
  it("normalises SSE content, reasoning and done events", async () => {
    const body = [
      'data: {"choices":[{"delta":{"reasoning":"Consider the options"}}]}',
      "",
      'data: {"choices":[{"delta":{"content":"Hello "}}]}',
      "",
      'data: {"choices":[{"delta":{"content":"world"}}],"usage":{"prompt_tokens":12,"completion_tokens":2}}',
      "",
      "data: [DONE]",
      "",
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } })));
    const events: any[] = [];
    await streamChat({
      provider: provider("openai"), model: model(), turns: [{ role: "user", content: "Hi" }],
      system: "test", signal: new AbortController().signal, onEvent: (event) => events.push(event),
    });
    expect(events.filter((e) => e.type === "text").map((e) => e.text).join("")).toBe("Hello world");
    expect(events.find((e) => e.type === "reasoning")?.text).toBe("Consider the options");
    expect(events.some((e) => e.type === "done")).toBe(true);
    expect(events.find((e) => e.type === "usage")?.outputTokens).toBe(2);
    const [url, init] = (fetch as any).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-test-1234");
  });

  it("never sends the key to a third party", async () => {
    const fetchMock = vi.fn(async () => new Response("data: [DONE]\n\n", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await streamChat({ provider: provider(), model: model(), turns: [], system: "", signal: new AbortController().signal, onEvent: () => {} });
    const [url] = fetchMock.mock.calls[0] as any;
    expect(new URL(url).host).toBe("api.openai.com");
  });

  it("reports provider errors as friendly events", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("invalid api key", { status: 401 })));
    const events: any[] = [];
    await streamChat({ provider: provider(), model: model(), turns: [], system: "", signal: new AbortController().signal, onEvent: (e) => events.push(e) });
    expect(events[0].type).toBe("error");
    expect(events[0].code).toBe("auth");
  });
});

describe("Anthropic streaming adapter", () => {
  it("uses x-api-key, the version header and direct browser access", async () => {
    const body = [
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"Let me think"}}',
      "",
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"A quiet answer"}}',
      "",
      'event: message_delta',
      'data: {"type":"message_delta","usage":{"input_tokens":10,"output_tokens":3}}',
      "",
    ].join("\n");
    const fetchMock = vi.fn(async () => new Response(body, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const events: any[] = [];
    await streamChat({ provider: provider("anthropic"), model: model(), turns: [{ role: "user", content: "Hi" }], system: "s", signal: new AbortController().signal, onEvent: (e) => events.push(e) });
    const [url, init] = fetchMock.mock.calls[0] as any;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("sk-test-1234");
    expect(init.headers["anthropic-version"]).toBe("2023-06-01");
    expect(init.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    expect(events.filter((e) => e.type === "text").map((e) => e.text).join("")).toBe("A quiet answer");
    expect(events.find((e) => e.type === "reasoning")?.text).toBe("Let me think");
  });
});

describe("Gemini streaming adapter", () => {
  it("uses streamGenerateContent?alt=sse and normalises the stream", async () => {
    const body = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Hello from Gemini"}]}}],"usageMetadata":{"promptTokenCount":8,"candidatesTokenCount":3}}',
      "",
    ].join("\n");
    const fetchMock = vi.fn(async () => new Response(body, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const events: any[] = [];
    await streamChat({ provider: provider("gemini"), model: model(), turns: [{ role: "user", content: "Hi" }], system: "s", signal: new AbortController().signal, onEvent: (e) => events.push(e) });
    const [url] = fetchMock.mock.calls[0] as any;
    expect(url).toContain("streamGenerateContent?alt=sse");
    expect(url).toContain("key=sk-test-1234");
    expect(events.filter((e) => e.type === "text").map((e) => e.text).join("")).toBe("Hello from Gemini");
  });
});

describe("model discovery", () => {
  it("uses the configured base URL and normalises data/models", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "model-a" }, { id: "model-b" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const names = await fetchProviderModels(provider());
    expect(names).toEqual(["model-a", "model-b"]);
    expect((fetchMock.mock.calls[0] as any)[0]).toBe("https://api.openai.com/v1/models");
  });

  it("surfaces an invalid key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    await expect(fetchProviderModels(provider())).rejects.toThrow("Invalid API key");
  });
});
