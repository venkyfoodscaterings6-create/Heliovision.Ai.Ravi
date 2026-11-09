import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  CircleAlert,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Star,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../store/useWorkspace";
import type { AIModel, NewProviderDraft, Provider, ProviderType } from "../lib/types";
import { DEFAULT_BASE_URLS, fetchProviderModels, testProvider } from "../lib/adapters";
import { Menu, MenuItem, MenuSeparator, Modal, StatusDot, Switch, Tip } from "./ui";
import { uid } from "../lib/seed";

const TYPE_META: Record<ProviderType, { label: string; short: string; mono: string }> = {
  openai: { label: "OpenAI-compatible", short: "OA", mono: "OpenAI, OpenRouter, Groq, Ollama and similar" },
  anthropic: { label: "Anthropic", short: "AN", mono: "Claude via the Messages API" },
  gemini: { label: "Google Gemini", short: "GM", mono: "Gemini via streamGenerateContent" },
};

const EMPTY_DRAFT: NewProviderDraft = { name: "", type: "openai", baseUrl: DEFAULT_BASE_URLS.openai, apiKey: "", headers: [], useProxy: false };

function ProviderForm({ editing, onClose }: { editing: Provider | "new" | null; onClose: () => void }) {
  const { addProvider, updateProvider, providers, toast } = useWorkspace();
  const isEdit = editing !== "new" && editing !== null;
  const [draft, setDraft] = useState<NewProviderDraft>({ ...EMPTY_DRAFT });
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!editing) return;
    if (editing === "new") { setDraft({ ...EMPTY_DRAFT }); setTestResult(null); setShowKey(false); return; }
    setDraft({ name: editing.name, type: editing.type, baseUrl: editing.baseUrl, apiKey: "", headers: editing.headers.length ? editing.headers : [], useProxy: editing.useProxy });
    setTestResult(null);
    setShowKey(false);
  }, [editing]);

  if (!editing) return null;

  const build = (): Provider => ({
    id: isEdit ? editing.id : uid("provider"),
    name: draft.name, type: draft.type, baseUrl: draft.baseUrl, apiKey: draft.apiKey || (isEdit ? editing.apiKey : ""),
    keyMasked: draft.apiKey ? `••••••••••••${draft.apiKey.slice(-4)}` : isEdit ? editing.keyMasked : "Not set",
    headers: draft.headers.filter((h) => h.key), status: isEdit ? editing.status : "untested",
    enabled: isEdit ? editing.enabled : true, useProxy: draft.useProxy, createdAt: isEdit ? editing.createdAt : Date.now(),
  });

  const changeType = (type: ProviderType) => {
    setDraft((d) => ({
      ...d,
      type,
      baseUrl: !d.baseUrl || Object.values(DEFAULT_BASE_URLS).includes(d.baseUrl) ? DEFAULT_BASE_URLS[type] : d.baseUrl,
    }));
    setTestResult(null);
  };

  const save = () => {
    if (!draft.name.trim() || !draft.baseUrl.trim()) return;
    if (isEdit) {
      updateProvider(editing.id, {
        name: draft.name.trim(), type: draft.type, baseUrl: draft.baseUrl.trim(), headers: draft.headers.filter((h) => h.key),
        useProxy: draft.useProxy, status: testResult?.ok ? "connected" : editing.status,
        ...(draft.apiKey ? { apiKey: draft.apiKey, keyMasked: `••••••••••••${draft.apiKey.slice(-4)}` } : {}),
      });
      toast("Provider updated");
    } else {
      addProvider({ ...draft, name: draft.name.trim(), baseUrl: draft.baseUrl.trim(), headers: draft.headers.filter((h) => h.key) });
      toast(`${draft.name.trim()} added`);
    }
    onClose();
  };

  const test = async () => {
    if (!draft.name || !draft.baseUrl) return;
    setTesting(true);
    setTestResult(null);
    const result = await testProvider(build());
    setTestResult(result);
    setTesting(false);
  };

  const existingNames = providers.filter((p) => !isEdit || p.id !== editing.id).map((p) => p.name.toLowerCase());
  const duplicateName = existingNames.includes(draft.name.trim().toLowerCase());

  return (
    <Modal open onClose={onClose} width="600px" full>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-soft)] px-5 py-4">
          <div><h2 className="text-[16px] font-[500]">{isEdit ? "Edit provider" : "Add provider"}</h2><p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">Keys are stored only in this browser and sent directly to the provider.</p></div>
          <button onClick={onClose} className="hv-icon-btn -mr-1 -mt-1"><X size={17} strokeWidth={1.5} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="hv-label" htmlFor="provider-name">Provider name</label>
              <input id="provider-name" autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. OpenRouter — work" className="hv-input" />
              {duplicateName && <p className="mt-1 text-[10.5px] text-[var(--warning)]">Another provider already uses this name. This is allowed.</p>}
              <p className="mt-1 text-[10.5px] text-[var(--text-muted)]">You can add several providers that share a base URL with different keys.</p>
            </div>
            <div>
              <label className="hv-label" htmlFor="provider-type">Provider type</label>
              <div className="relative">
                <select id="provider-type" value={draft.type} onChange={(e) => changeType(e.target.value as ProviderType)} className="hv-input appearance-none pr-8">
                  <option value="openai">OpenAI-compatible</option><option value="anthropic">Anthropic</option><option value="gemini">Google Gemini</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              </div>
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">{TYPE_META[draft.type].mono}</p>
            </div>
            <div>
              <label className="hv-label" htmlFor="provider-key">API key</label>
              <div className="relative"><input id="provider-key" type={showKey ? "text" : "password"} value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} placeholder={isEdit ? `Saved ${editing.keyMasked} — leave blank to keep` : "sk-…"} className="hv-input pr-10 font-mono text-[12px]" autoComplete="off" spellCheck={false} /><button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-hover)]" aria-label={showKey ? "Hide key" : "Show key"}>{showKey ? <EyeOff size={14} /> : <Eye size={14} />}</button></div>
              {isEdit && <p className="mt-1 text-[10px] text-[var(--text-muted)]">A saved key is never shown in full again.</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="hv-label" htmlFor="provider-url">Base URL</label>
              <input id="provider-url" value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" className="hv-input font-mono text-[12px]" spellCheck={false} />
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">Requests go to this exact base URL. https is recommended; http is accepted for local inference only.</p>
            </div>
          </div>

          <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
            <div className="flex items-center justify-between"><span className="text-[12px] font-medium">Custom headers</span><button onClick={() => setDraft({ ...draft, headers: [...draft.headers, { key: "", value: "" }] })} className="flex items-center gap-1 text-[11px] text-[var(--accent-text)] hover:underline"><Plus size={12} /> Add header</button></div>
            {!draft.headers.length && <p className="mt-1.5 text-[10.5px] text-[var(--text-muted)]">Optional. Add HTTP-Referer, X-Title or other provider-specific headers.</p>}
            <div className="mt-2 space-y-2">
              {draft.headers.map((header, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input value={header.key} onChange={(e) => setDraft({ ...draft, headers: draft.headers.map((h, i) => i === index ? { ...h, key: e.target.value } : h) })} placeholder="Header name" className="hv-input !h-8 font-mono text-[11px]" aria-label="Header name" />
                  <input value={header.value} onChange={(e) => setDraft({ ...draft, headers: draft.headers.map((h, i) => i === index ? { ...h, value: e.target.value } : h) })} placeholder="Value" className="hv-input !h-8 font-mono text-[11px]" aria-label="Header value" />
                  <button onClick={() => setDraft({ ...draft, headers: draft.headers.filter((_, i) => i !== index) })} className="hv-icon-btn !size-8 shrink-0" aria-label="Remove header"><X size={13} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-start justify-between gap-4 rounded-lg border border-[var(--border-soft)] bg-[var(--code-bg)] px-3.5 py-3">
            <div><div className="flex items-center gap-1.5 text-[12px] font-[450]"><Server size={13} /> Route through proxy</div><p className="mt-0.5 text-[10.5px] leading-relaxed text-[var(--text-muted)]">Use /api/proxy if the provider blocks browser requests (CORS). Headers and bodies are never stored or logged.</p></div>
            <Switch checked={draft.useProxy} onChange={(value) => setDraft({ ...draft, useProxy: value })} label="Route through proxy" />
          </div>

          {testResult && <div className={`mt-4 flex items-start gap-2 rounded-lg border p-3 text-[11.5px] ${testResult.ok ? "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_7%,transparent)] text-[var(--success)]" : "border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_5%,transparent)] text-[var(--danger)]"}`}>{testResult.ok ? <Check size={14} className="mt-px shrink-0" /> : <CircleAlert size={14} className="mt-px shrink-0" />}{testResult.message}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2 border-t border-[var(--border-soft)] p-4">
          <button onClick={test} disabled={testing || !draft.baseUrl} className="hv-btn hv-btn-secondary">{testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} strokeWidth={1.5} />} Test connection</button>
          <div className="ml-auto flex gap-2"><button onClick={onClose} className="hv-btn hv-btn-ghost">Cancel</button><button onClick={save} disabled={!draft.name.trim() || !draft.baseUrl.trim()} className="hv-btn hv-btn-primary">{isEdit ? "Save changes" : "Save provider"}</button></div>
        </div>
      </div>
    </Modal>
  );
}

function ProviderCard({ provider, onEdit, onDelete, onFetch }: { provider: Provider; onEdit: () => void; onDelete: () => void; onFetch: () => void }) {
  const { models, updateProvider, toast } = useWorkspace();
  const [testing, setTesting] = useState(false);
  const count = models.filter((m) => m.providerId === provider.id).length;
  const statusLabel = provider.status === "connected" ? "Connected" : provider.status === "error" ? "Error" : "Untested";

  const test = async () => {
    setTesting(true);
    const result = await testProvider(provider);
    updateProvider(provider.id, { status: result.ok ? "connected" : "error" });
    toast(result.ok ? `${provider.name} connected` : `${provider.name}: ${result.message}`);
    setTesting(false);
  };

  return (
    <article className={`rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface)] p-3.5 transition-colors hover:border-[var(--border)] ${!provider.enabled ? "opacity-65" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-[var(--code-bg)] font-mono text-[10px] font-medium text-[var(--text-muted-strong)]">{TYPE_META[provider.type].short}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5"><h3 className="truncate text-[12.5px] font-[500]">{provider.name}</h3><span className={`hv-badge !h-5 gap-1 !px-1.5 !text-[9px] ${provider.status === "connected" ? "!bg-[color-mix(in_srgb,var(--success)_10%,transparent)] !text-[var(--success)]" : provider.status === "error" ? "!bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] !text-[var(--danger)]" : ""}`}><StatusDot status={provider.status} /> {statusLabel}</span></div>
          <p className="mt-1 truncate font-mono text-[10.5px] text-[var(--text-muted)]">{provider.baseUrl}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1"><KeyRound size={10} /> {provider.keyMasked || "No key"}</span>
            <span className="flex items-center gap-1"><Sparkles size={10} /> {count} model{count === 1 ? "" : "s"}</span>
            <span>{TYPE_META[provider.type].label}</span>
            {provider.useProxy && <span className="flex items-center gap-1 text-[var(--accent-text)]"><Server size={10} /> Proxy</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tip label={provider.enabled ? "Disable provider" : "Enable provider"}><span><Switch checked={provider.enabled} onChange={(enabled) => updateProvider(provider.id, { enabled })} label="Enable provider" /></span></Tip>
          <Menu className="hv-icon-btn !size-7" align="end" contentClassName="w-[185px]" trigger={<MoreHorizontal size={15} />}>
            <MenuItem icon={<Pencil size={14} />} onSelect={onEdit}>Edit provider</MenuItem>
            <MenuItem icon={<Zap size={14} />} onSelect={() => void test()}>Test connection</MenuItem>
            <MenuItem icon={<RefreshCw size={14} />} onSelect={onFetch}>Fetch models</MenuItem>
            <MenuItem icon={<Plus size={14} />} onSelect={onFetch}>Manage models</MenuItem>
            <MenuSeparator /><MenuItem icon={<Trash2 size={14} />} danger onSelect={onDelete}>Delete provider</MenuItem>
          </Menu>
        </div>
      </div>
      <div className="mt-3 flex gap-2 border-t border-[var(--border-soft)] pt-2.5">
        <button onClick={() => void test()} disabled={testing} className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[10.5px] text-[var(--text-muted-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">{testing ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} strokeWidth={1.5} />} Test</button>
        <button onClick={onFetch} className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[10.5px] text-[var(--text-muted-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"><RefreshCw size={11} strokeWidth={1.5} /> Fetch models</button>
        <button onClick={onEdit} className="ml-auto flex items-center gap-1.5 rounded px-1.5 py-1 text-[10.5px] text-[var(--text-muted-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"><Pencil size={11} /> Edit</button>
      </div>
    </article>
  );
}

function FetchModelsModal({ provider, onClose }: { provider: Provider | null; onClose: () => void }) {
  const { addModel, models, toast } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<string[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!provider) return;
    let live = true;
    setLoading(true); setError(""); setAvailable([]); setChecked([]);
    fetchProviderModels(provider)
      .then((list) => { if (live) setAvailable(list.sort()); })
      .catch((err) => { if (live) setError(err instanceof Error ? err.message : "Could not fetch models."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [provider]);

  if (!provider) return null;
  const currentIds = new Set(models.filter((m) => m.providerId === provider.id).map((m) => m.modelId));
  const filtered = available.filter((id) => id.toLowerCase().includes(search.toLowerCase()));
  const toggle = (id: string) => setChecked((c) => c.includes(id) ? c.filter((x) => x !== id) : [...c, id]);
  const save = () => {
    checked.forEach((modelId, index) => {
      if (currentIds.has(modelId)) return;
      const lower = modelId.toLowerCase();
      addModel({
        id: uid("model"), providerId: provider.id, modelId, name: modelId.split("/").pop()?.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? modelId,
        description: `Discovered from ${provider.name}`,
        capabilities: { vision: /vision|gpt-4|gpt-5|claude|gemini/i.test(lower), reasoning: /reason|think|sonnet|o1|o3|r1/i.test(lower), files: true },
        enabled: true, sort: models.length + index,
      });
    });
    toast(`${checked.length} model${checked.length === 1 ? "" : "s"} added`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Fetch models" description={`${provider.name} · ${provider.baseUrl}`} width="570px">
      {loading ? (
        <div className="p-5">
          <div className="mb-3 flex items-center gap-2 text-[12px] text-[var(--text-muted)]"><Loader2 size={14} className="animate-spin" /> Asking the provider for its model list…</div>
          {[1, 2, 3, 4].map((i) => <div key={i} className="mb-2 h-10 animate-pulse rounded-lg bg-[var(--surface-hover)]" />)}
        </div>
      ) : error ? (
        <div className="p-5">
          <div className="rounded-lg border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_5%,transparent)] p-4"><div className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--danger)]"><CircleAlert size={15} /> Could not fetch models</div><p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--text-muted-strong)]">{error} Check the API key and base URL, or add the exact model ID manually.</p></div>
          <div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className="hv-btn hv-btn-secondary">Close</button><button onClick={onClose} className="hv-btn hv-btn-primary"><Plus size={13} /> Add model manually</button></div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-[var(--border-soft)] px-4 py-3">
            <div className="relative flex-1"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search available models…" className="hv-input !h-8 pl-8 text-[12px]" /></div>
            <button onClick={() => setChecked(filtered.filter((id) => !currentIds.has(id)))} className="text-[10.5px] text-[var(--accent-text)] hover:underline">Select all</button>
            <span className="text-[10px] text-[var(--text-muted)]">{available.length} found</span>
          </div>
          <div className="max-h-[340px] min-h-[150px] overflow-y-auto p-2">
            {filtered.map((id) => {
              const exists = currentIds.has(id);
              return <button key={id} onClick={() => !exists && toggle(id)} disabled={exists} className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[11.5px] hover:bg-[var(--surface-hover)] disabled:opacity-50 ${checked.includes(id) ? "bg-[var(--accent-soft)]" : ""}`}><span className={`flex size-[15px] shrink-0 items-center justify-center rounded-[3px] border ${checked.includes(id) ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)]"}`}>{checked.includes(id) && <Check size={10} />}</span><span className="min-w-0 flex-1 truncate font-mono text-[11px]">{id}</span>{exists && <span className="hv-badge !h-5 !text-[9px]">Added</span>}</button>;
            })}
            {!filtered.length && <div className="py-10 text-center text-[12px] text-[var(--text-muted)]">No models found. The provider may use a different models endpoint.</div>}
          </div>
          <div className="flex shrink-0 items-center justify-between border-t border-[var(--border-soft)] p-4"><span className="text-[11px] text-[var(--text-muted)]">{checked.length} selected</span><div className="flex gap-2"><button onClick={onClose} className="hv-btn hv-btn-secondary">Cancel</button><button onClick={save} disabled={!checked.length} className="hv-btn hv-btn-primary">Enable {checked.length || ""} model{checked.length === 1 ? "" : "s"}</button></div></div>
        </div>
      )}
    </Modal>
  );
}

function ModelForm({ providerId, editing, onClose }: { providerId?: string; editing: AIModel | null; onClose: () => void }) {
  const { providers, addModel, updateModel, models, toast } = useWorkspace();
  const [provider, setProvider] = useState(providerId ?? providers[0]?.id ?? "");
  const [modelId, setModelId] = useState(editing?.modelId ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [capabilities, setCapabilities] = useState(editing?.capabilities ?? { vision: false, reasoning: false, files: true });
  const [maxTokens, setMaxTokens] = useState(editing?.maxOutputTokens ? String(editing.maxOutputTokens) : "");
  const save = () => {
    if (!modelId.trim() || !name.trim() || !provider) return;
    if (editing) {
      updateModel(editing.id, { providerId: provider, modelId: modelId.trim(), name: name.trim(), description: description.trim(), capabilities, maxOutputTokens: maxTokens ? Number(maxTokens) : undefined });
      toast("Model updated");
    } else {
      addModel({ id: uid("model"), providerId: provider, modelId: modelId.trim(), name: name.trim(), description: description.trim(), capabilities, maxOutputTokens: maxTokens ? Number(maxTokens) : undefined, enabled: true, sort: models.length });
      toast("Model added");
    }
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={editing ? "Edit model" : "Add model manually"} description="The model ID is sent exactly as written to the provider." width="520px">
      <div className="min-h-0 overflow-y-auto p-5">
        <label className="hv-label" htmlFor="model-provider">Provider</label>
        <div className="relative"><select id="model-provider" value={provider} onChange={(e) => setProvider(e.target.value)} className="hv-input appearance-none pr-8">{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /></div>
        <div className="mt-4"><label className="hv-label" htmlFor="model-id">Model ID</label><input id="model-id" value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="e.g. meta-llama/llama-3.3-70b-instruct" className="hv-input font-mono text-[11.5px]" spellCheck={false} /></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><div><label className="hv-label" htmlFor="model-name">Display name</label><input id="model-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Llama 3.3 70B" className="hv-input" /></div><div><label className="hv-label" htmlFor="model-max">Max output tokens</label><input id="model-max" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value.replace(/\D/g, ""))} placeholder="Optional" className="hv-input" inputMode="numeric" /></div></div>
        <div className="mt-4"><label className="hv-label" htmlFor="model-desc">Short description</label><input id="model-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this model good at?" className="hv-input" /></div>
        <div className="mt-4"><span className="hv-label">Capabilities</span><div className="grid grid-cols-3 gap-2">{(Object.keys(capabilities) as ("vision" | "reasoning" | "files")[]).map((cap) => <button key={cap} onClick={() => setCapabilities({ ...capabilities, [cap]: !capabilities[cap] })} className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] capitalize ${capabilities[cap] ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]" : "border-[var(--border-soft)] text-[var(--text-muted)]"}`}>{capabilities[cap] && <Check size={11} />}{cap}</button>)}</div><p className="mt-1.5 text-[10px] text-[var(--text-muted)]">Only enable features the provider natively supports. Unsupported toggles are disabled in the composer.</p></div>
        <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="hv-btn hv-btn-secondary">Cancel</button><button onClick={save} disabled={!modelId.trim() || !name.trim() || !provider} className="hv-btn hv-btn-primary">{editing ? "Save changes" : "Add model"}</button></div>
      </div>
    </Modal>
  );
}

export function ProviderSettings() {
  const { providers, models, addProvider, openSettings, updateModel, setDefaultModel, removeModel, toast, selectedModelId } = useWorkspace();
  const [form, setForm] = useState<Provider | "new" | null>(null);
  const [fetchFor, setFetchFor] = useState<Provider | null>(null);
  const [deleteProvider, setDeleteProvider] = useState<Provider | null>(null);
  const [modelForm, setModelForm] = useState<{ providerId?: string; editing: AIModel | null } | null>(null);
  const [deleteModel, setDeleteModel] = useState<AIModel | null>(null);
  const [modelQuery, setModelQuery] = useState("");
  const filteredModels = useMemo(() => [...models].sort((a, b) => a.sort - b.sort).filter((m) => m.name.toLowerCase().includes(modelQuery.toLowerCase()) || m.modelId.toLowerCase().includes(modelQuery.toLowerCase())), [models, modelQuery]);
  const enabledCount = models.filter((m) => m.enabled).length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[780px] px-5 pb-12 pt-5 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-[17px] font-[500]">Models & providers</h2><p className="mt-1 max-w-[480px] text-[11.5px] leading-relaxed text-[var(--text-muted)]">Bring your own keys. Add any OpenAI-compatible endpoint, Anthropic or Gemini — as many as you like.</p></div>
          <button onClick={() => setForm("new")} className="hv-btn hv-btn-primary !h-8 text-[11.5px]"><Plus size={14} /> Add provider</button>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--success)_24%,transparent)] bg-[color-mix(in_srgb,var(--success)_5%,transparent)] px-3 py-2.5">
          <KeyRound size={13} className="mt-0.5 shrink-0 text-[var(--success)]" />
          <p className="text-[10.5px] leading-relaxed text-[var(--text-muted-strong)]"><span className="font-medium text-[var(--text)]">Keys stay in this browser.</span> They are sent only to the provider's own base URL (or your proxy) and are never attached to analytics or logs.</p>
        </div>

        <section className="mt-6">
          <div className="mb-2.5 flex items-center justify-between"><h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)]">Providers <span className="ml-1 tabular-nums">{providers.length}</span></h3><button onClick={() => openSettings("formats")} className="text-[10.5px] text-[var(--text-muted)] hover:text-[var(--accent-text)]">Demo model is always on</button></div>
          <div className="space-y-2.5">
            {providers.map((provider) => <ProviderCard key={provider.id} provider={provider} onEdit={() => setForm(provider)} onDelete={() => setDeleteProvider(provider)} onFetch={() => { setFetchFor(provider); }} />)}
            {!providers.length && (
              <div className="rounded-[12px] border border-dashed border-[var(--border)] px-5 py-8 text-center">
                <div className="mx-auto mb-2.5 flex size-9 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--accent-text)]"><Plus size={17} /></div>
                <div className="text-[12.5px] font-[450]">Add your first provider</div><p className="mx-auto mt-1 max-w-[340px] text-[11px] leading-relaxed text-[var(--text-muted)]">You can keep using the labelled Demo model while you decide.</p>
                <button onClick={() => setForm("new")} className="hv-btn hv-btn-primary mt-3 !h-8 text-[11.5px]">Add provider</button>
              </div>
            )}
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)]">Models <span className="ml-1 tabular-nums">{models.length}</span> <span className="ml-1 normal-case tracking-normal text-[var(--text-muted)]">· {enabledCount} enabled</span></h3>
            <div className="relative ml-auto"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input value={modelQuery} onChange={(e) => setModelQuery(e.target.value)} placeholder="Filter models" className="hv-input !h-7 w-[145px] pl-7 text-[11px]" /></div>
            <button onClick={() => setModelForm({ editing: null })} disabled={!providers.length} className="hv-btn hv-btn-secondary !h-7 !px-2 text-[10.5px]"><Plus size={11} /> Manual</button>
          </div>
          <div className="overflow-hidden rounded-[12px] border border-[var(--border-soft)] bg-[var(--surface)]">
            {filteredModels.length === 0 ? (
              <div className="px-4 py-8 text-center text-[11.5px] text-[var(--text-muted)]">No models match “{modelQuery}”.</div>
            ) : filteredModels.map((model, index) => {
              const provider = providers.find((p) => p.id === model.providerId);
              return (
                <div key={model.id} className={`group flex items-center gap-2 px-3 py-2.5 hover:bg-[var(--surface-hover)] ${index > 0 ? "border-t border-[var(--border-soft)]" : ""}`}>
                  <Switch checked={model.enabled} onChange={(enabled) => updateModel(model.id, { enabled })} label={`Enable ${model.name}`} />
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-md ${model.isDemo ? "bg-[var(--accent-soft)] text-[var(--accent-text)]" : "bg-[var(--code-bg)] text-[var(--text-muted-strong)]"}`}>{model.isDemo ? <Sparkles size={12} /> : <span className="text-[8px] font-medium">{model.name.slice(0, 2).toUpperCase()}</span>}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5"><span className="truncate text-[12px] font-[450]">{model.name}</span>{model.isDemo && <span className="hv-badge !h-4 !px-1.5 !text-[8px] uppercase">Demo</span>}{selectedModelId === model.id && <span className="flex items-center gap-1 text-[8.5px] uppercase tracking-wide text-[var(--accent-text)]"><Check size={9} /> Selected</span>}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[9.5px] text-[var(--text-muted)]"><span className="truncate font-mono">{model.modelId}</span><span>·</span><span>{provider?.name ?? "Demo workspace"}</span><span className="hidden sm:inline">·</span><span className="hidden gap-1 sm:flex">{model.capabilities.vision && "Vision"}{model.capabilities.reasoning && " · Reasoning"}{model.capabilities.files && " · Files"}</span></div>
                  </div>
                  <div className="hidden items-center gap-0.5 md:flex">
                    <Tip label="Move up"><button onClick={() => updateModel(model.id, { sort: model.sort - 1.5 })} className="hv-icon-btn !size-6"><ArrowUp size={12} /></button></Tip>
                    <Tip label="Move down"><button onClick={() => updateModel(model.id, { sort: model.sort + 1.5 })} className="hv-icon-btn !size-6"><ArrowDown size={12} /></button></Tip>
                  </div>
                  <Menu className={`hv-icon-btn !size-7 ${model.isDefault ? "!text-[var(--accent)]" : ""}`} align="end" contentClassName="w-[190px]" trigger={model.isDefault ? <Star size={13} fill="currentColor" strokeWidth={1.5} /> : <MoreHorizontal size={15} />}>
                    <MenuItem icon={<Pencil size={14} />} onSelect={() => setModelForm({ editing: model })}>{model.isDemo ? "View demo model" : "Edit model"}</MenuItem>
                    <MenuItem icon={<Star size={14} />} onSelect={() => setDefaultModel(model.id)}>Set as default</MenuItem>
                    <MenuItem icon={<Check size={14} />} onSelect={() => useWorkspace.getState().selectModel(model.id)}>Use in composer</MenuItem>
                    <MenuItem icon={<ArrowUp size={14} />} onSelect={() => updateModel(model.id, { sort: models.length + 1 })}>Move to top</MenuItem>
                    {!model.isDemo && <><MenuSeparator /><MenuItem icon={<Trash2 size={14} />} danger onSelect={() => setDeleteModel(model)}>Remove model</MenuItem></>}
                  </Menu>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-[var(--text-muted)]">Only enabled models appear in the composer. No model IDs are hard-coded by HelioVision.</p>
        </section>
      </div>

      <ProviderForm editing={form} onClose={() => setForm(null)} />
      <FetchModelsModal provider={fetchFor} onClose={() => setFetchFor(null)} />
      {modelForm && <ModelForm providerId={modelForm.providerId} editing={modelForm.editing} onClose={() => setModelForm(null)} />}

      <Modal open={Boolean(deleteProvider)} onClose={() => setDeleteProvider(null)} title="Delete provider?" width="430px">
        <div className="p-5"><p className="text-[12.5px] leading-relaxed text-[var(--text-muted-strong)]">“{deleteProvider?.name}” and all of its models will be removed. The API key will be erased from this browser.</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setDeleteProvider(null)} className="hv-btn hv-btn-secondary">Cancel</button><button onClick={() => { if (deleteProvider) { const removed = deleteProvider; useWorkspace.getState().removeProvider(removed.id); setDeleteProvider(null); toast("Provider deleted", { label: "Undo", onClick: () => { addProvider({ name: removed.name, type: removed.type, baseUrl: removed.baseUrl, apiKey: removed.apiKey, headers: removed.headers, useProxy: removed.useProxy }); } }); } }} className="hv-btn hv-btn-primary !bg-[var(--danger)]">Delete provider</button></div></div>
      </Modal>
      <Modal open={Boolean(deleteModel)} onClose={() => setDeleteModel(null)} title="Remove model?" width="420px">
        <div className="p-5"><p className="text-[12.5px] text-[var(--text-muted-strong)]">“{deleteModel?.name}” will no longer appear in the model selector.</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setDeleteModel(null)} className="hv-btn hv-btn-secondary">Cancel</button><button onClick={() => { if (deleteModel) { removeModel(deleteModel.id); setDeleteModel(null); toast("Model removed"); } }} className="hv-btn hv-btn-primary !bg-[var(--danger)]">Remove</button></div></div>
      </Modal>
    </div>
  );
}
