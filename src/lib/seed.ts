import type { AIModel, Chat, GeneratedFile, GeneralSettings, Message, Project, Provider } from "./types";

const now = Date.now();
export const uid = (prefix = "id") => `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;

export const DEMO_MODEL: AIModel = {
  id: "model_demo",
  providerId: "demo",
  modelId: "heliovision-demo",
  name: "Helio Demo",
  description: "A guided preview — no API key needed",
  capabilities: { vision: true, reasoning: true, files: true },
  enabled: true,
  isDefault: true,
  sort: 0,
  isDemo: true,
};

export const seedProviders: Provider[] = [
  {
    id: "provider_openrouter",
    name: "OpenRouter — Personal",
    type: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "",
    keyMasked: "••••••••••••4f2a",
    headers: [],
    status: "connected",
    enabled: true,
    useProxy: false,
    createdAt: now - 1000 * 60 * 60 * 24 * 96,
  },
  {
    id: "provider_anthropic",
    name: "Anthropic — Research",
    type: "anthropic",
    baseUrl: "https://api.anthropic.com",
    apiKey: "",
    keyMasked: "••••••••••••9c17",
    headers: [],
    status: "connected",
    enabled: true,
    useProxy: false,
    createdAt: now - 1000 * 60 * 60 * 24 * 68,
  },
  {
    id: "provider_ollama",
    name: "Ollama — Local",
    type: "openai",
    baseUrl: "http://localhost:11434/v1",
    apiKey: "",
    keyMasked: "No key",
    headers: [],
    status: "untested",
    enabled: false,
    useProxy: false,
    createdAt: now - 1000 * 60 * 60 * 24 * 33,
  },
];

export const seedModels: AIModel[] = [
  DEMO_MODEL,
  {
    id: "model_claude",
    providerId: "provider_anthropic",
    modelId: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    description: "Balanced speed and depth for everyday work",
    capabilities: { vision: true, reasoning: true, files: true },
    maxOutputTokens: 8192,
    enabled: true,
    sort: 1,
  },
  {
    id: "model_gpt",
    providerId: "provider_openrouter",
    modelId: "openai/gpt-4.1",
    name: "GPT-4.1",
    description: "Precise coding and long-context analysis",
    capabilities: { vision: true, reasoning: false, files: true },
    maxOutputTokens: 16384,
    enabled: true,
    sort: 2,
  },
  {
    id: "model_gemini",
    providerId: "provider_openrouter",
    modelId: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    description: "Multimodal reasoning with a huge context window",
    capabilities: { vision: true, reasoning: true, files: true },
    maxOutputTokens: 8192,
    enabled: true,
    sort: 3,
  },
  {
    id: "model_deepseek",
    providerId: "provider_openrouter",
    modelId: "deepseek/deepseek-chat-v3-0324",
    name: "DeepSeek V3",
    description: "Fast, economical open model",
    capabilities: { vision: false, reasoning: false, files: false },
    maxOutputTokens: 8192,
    enabled: true,
    sort: 4,
  },
  {
    id: "model_llama",
    providerId: "provider_ollama",
    modelId: "llama3.2:latest",
    name: "Llama 3.2",
    description: "Private inference on this machine",
    capabilities: { vision: false, reasoning: false, files: false },
    enabled: false,
    sort: 5,
  },
];

const day = 1000 * 60 * 60 * 24;

export const seedProjects: Project[] = [
  {
    id: "project_northstar",
    name: "Northstar launch",
    description: "Everything for the September product launch — narrative, launch assets and the week-one plan.",
    instructions: "You are a senior product marketing partner. Be concise, decisive and grounded in evidence. Use British spelling. Always suggest the next concrete action.",
    files: ["Northstar positioning.md", "Launch checklist.pdf"],
    color: "#D97757",
    createdAt: now - day * 18,
    updatedAt: now - day * 1,
  },
  {
    id: "project_writing",
    name: "Writing studio",
    description: "Essays, newsletter drafts and a long-form book proposal. Voice: considered, warm, never breathless.",
    instructions: "Act as a careful editor. Preserve the author's voice. Flag clichés and abstractions. Offer one strong revision, not ten weak options.",
    files: ["Voice notes.md", "Essay — The quiet hours.docx"],
    color: "#7A8C67",
    createdAt: now - day * 42,
    updatedAt: now - day * 4,
  },
  {
    id: "project_studio",
    name: "Studio operations",
    description: "Weekly finance reviews, client delivery and the systems that keep a small studio running.",
    instructions: "Be practical and numbers-first. Show your assumptions. Format financial summaries with a markdown table and clear takeaway.",
    files: ["Revenue model.xlsx", "Studio KPIs.csv"],
    color: "#8D7BA6",
    createdAt: now - day * 60,
    updatedAt: now - day * 9,
  },
];

export const seedChats: Chat[] = [
  { id: "chat_weekly", title: "Weekly revenue breakdown", starred: true, projectId: "project_studio", createdAt: now - 1000 * 60 * 60 * 5, updatedAt: now - 1000 * 60 * 60 * 2 },
  { id: "chat_launch", title: "Northstar launch narrative", starred: false, projectId: "project_northstar", createdAt: now - 1000 * 60 * 60 * 26, updatedAt: now - 1000 * 60 * 60 * 25 },
  { id: "chat_quiet", title: "Refining 'The quiet hours'", starred: true, projectId: "project_writing", createdAt: now - day - 1000 * 60 * 60 * 6, updatedAt: now - day - 1000 * 60 * 60 * 5 },
  { id: "chat_seo", title: "SEO brief for the new site", starred: false, createdAt: now - day - 1000 * 60 * 60 * 12, updatedAt: now - day - 1000 * 60 * 60 * 8 },
  { id: "chat_kyoto", title: "A quiet week in Kyoto", starred: false, createdAt: now - day * 3, updatedAt: now - day * 3 },
  { id: "chat_sql", title: "Make this query 10× faster", starred: false, projectId: "project_studio", createdAt: now - day * 5, updatedAt: now - day * 5 },
  { id: "chat_onboard", title: "Client onboarding email", starred: false, createdAt: now - day * 8, updatedAt: now - day * 8 },
  { id: "chat_pricing", title: "Pricing page workshop", starred: false, createdAt: now - day * 12, updatedAt: now - day * 12 },
  { id: "chat_reading", title: "Reading list for autumn", starred: false, createdAt: now - day * 19, updatedAt: now - day * 19 },
];

const briefTable = `| Channel | Revenue | Share | MoM |
| --- | ---: | ---: | ---: |
| Retainers | £18,400 | 58% | +6.2% |
| Productised work | £8,950 | 28% | +14.8% |
| Workshops | £4,420 | 14% | -3.1% |
| **Total** | **£31,770** | **100%** | **+8.4%** |`;

export const seedMessages: Message[] = [
  {
    id: "msg_w1",
    chatId: "chat_weekly",
    role: "user",
    content: "Here are this week's numbers. Can you break down where growth is coming from and flag anything I should be worried about?",
    createdAt: now - 1000 * 60 * 60 * 3,
  },
  {
    id: "msg_w2",
    chatId: "chat_weekly",
    role: "assistant",
    content: `The headline is healthy: revenue grew **8.4% week on week**, and the growth is concentrated in the most durable part of the mix.

${briefTable}

### What's driving it

1. **Productised work is your growth engine.** It added ~£1,150 and now represents 28% of revenue, up from 26%. That is repeatable demand, not one-off favours.
2. **Retainers stayed steady.** A 6.2% lift is roughly in line with the two new days you added, so there is no meaningful price movement.
3. **Workshops softened slightly.** One cancelled session explains nearly all of the £140 decline.

### Worth watching

The studio is becoming more dependent on fewer, larger retainers. Your top two clients now account for an estimated **41% of revenue** — still reasonable, but worth tracking monthly.

> A simple rule: no single client above 20%, and no channel above 60% of revenue.

**Next step:** I would send the productised-work waitlist a small December cohort offer while demand is warm.`,
    reasoning: "Checked the implied prior-week totals, compared channel shares, and separated one-off cancellations from real contraction. The concentration risk is the only signal that warrants attention, but it is not yet urgent.",
    thinkingMs: 6400,
    providerId: "provider_anthropic",
    providerName: "Anthropic — Research",
    model: "Claude Sonnet 4",
    createdAt: now - 1000 * 60 * 60 * 2.9,
  },
  {
    id: "msg_l1",
    chatId: "chat_launch",
    role: "user",
    content: "Draft the core launch narrative for Northstar. The audience is independent studio owners who are overwhelmed by admin.",
    createdAt: now - 1000 * 60 * 60 * 26,
  },
  {
    id: "msg_l2",
    chatId: "chat_launch",
    role: "assistant",
    content: `## Northstar: your studio, running with less drag

Most independent studios do not have an operations problem. They have a **visibility** problem.

The work is there. The clients are good. But the true cost of a project is scattered across six tabs, three invoices and a spreadsheet that only one person understands.

Northstar brings the whole shape of a studio into one quiet view — so the next decision takes minutes, not a lost afternoon.

**The narrative in one line**

> For studio owners who are done stitching their business together from spreadsheets, Northstar is the calm operating view that turns scattered work into one clear picture.

### Three supporting messages

- **See the whole week** — delivery, cash and capacity in one place.
- **Decide with context** — every number links back to the work that created it.
- **Leave admin at the door** — no new system to maintain, ever.

I would lead the launch page with *visibility*, not *automation*. Automation is the mechanism; a calmer week is the promise.`,
    providerId: "provider_openrouter",
    providerName: "OpenRouter — Personal",
    model: "GPT-4.1",
    createdAt: now - 1000 * 60 * 60 * 25.8,
  },
  {
    id: "msg_q1",
    chatId: "chat_quiet",
    role: "user",
    content: "This paragraph still feels like it's trying too hard. Can you make it quieter without flattening it?\n\n\"The city does not care that you have arrived. It goes on being itself, indifferent and magnificent, while you stand at the window inventing a version of yourself that might finally belong.\"",
    createdAt: now - day - 1000 * 60 * 60 * 6,
  },
  {
    id: "msg_q2",
    chatId: "chat_quiet",
    role: "assistant",
    content: `You are right — the paragraph is asking to be admired. Two phrases are doing the work too visibly: *indifferent and magnificent*, and *a version of yourself that might finally belong*.

Here is a quieter pass:

> The city does not care that you have arrived. It goes on being itself — the buses, the bakery lights, the woman arguing softly with her dog. You stand at the window and practise a life in which you already live here.

The city no longer performs its indifference; the details simply continue. That gives the reader room to feel the loneliness instead of being told about it.

**One note on the ending:** *practise a life* is more vulnerable than *invent a version of yourself*. It implies the life might be real.`,
    reasoning: "Read the original line by line. Identified two abstractions that inflate the register: the paired adjectives and the aspirational self. Replaced explanation with concrete sounds and a gentler verb.",
    thinkingMs: 3800,
    providerId: "provider_anthropic",
    providerName: "Anthropic — Research",
    model: "Claude Sonnet 4",
    createdAt: now - day - 1000 * 60 * 60 * 5.9,
  },
  {
    id: "msg_s1",
    chatId: "chat_seo",
    role: "user",
    content: "Give me an SEO brief for a new independent design studio site. Three service pages, one journal, one contact page.",
    createdAt: now - day - 1000 * 60 * 60 * 12,
  },
  {
    id: "msg_s2",
    chatId: "chat_seo",
    role: "assistant",
    content: `Here is a lean brief you can hand directly to a writer.

### 1. Establish one primary intent per page

| Page | Primary keyword | Supporting concepts |
| --- | --- | --- |
| Brand design | independent brand design studio | identity, positioning |
| Digital products | product design studio London | UX, interface |
| Workshops | brand strategy workshop | facilitation |
| Journal | design studio notes | process, craft |

### 2. Write for a person, not a crawler

Your advantage is specificity. Instead of "we craft compelling digital experiences", name a client, a constraint and a result. Search engines are increasingly good at recognising original expertise.

### 3. Technical essentials

- One H1 per page, descriptive title under 60 characters.
- Service pages should interlink through real examples.
- Add \`Organization\` and \`Article\` structured data.
- Keep the journal dates honest and visible.

**First priority:** your three service pages need a clear, human sentence about who you are *not* for. It will convert better than another adjective.`,
    model: "Gemini 2.5 Pro",
    providerId: "provider_openrouter",
    providerName: "OpenRouter — Personal",
    createdAt: now - day - 1000 * 60 * 60 * 11.8,
  },
];

export const seedFiles: GeneratedFile[] = [
  {
    id: "file_revenue",
    name: "studio-revenue-week-24.xlsx",
    format: "xlsx",
    content: briefTable,
    createdAt: now - 1000 * 60 * 60 * 2,
    chatId: "chat_weekly",
    size: 12480,
  },
  {
    id: "file_brief",
    name: "northstar-launch-brief.md",
    format: "md",
    content: `# Northstar launch brief\n\n**Audience:** independent studio owners\n\n**Core promise:** one clear view of your studio.\n\n${briefTable}\n\n> Lead with visibility, not automation.`,
    createdAt: now - day,
    chatId: "chat_launch",
    size: 5120,
  },
  {
    id: "file_kpis",
    name: "studio-kpis.csv",
    format: "csv",
    content: "channel,revenue,share,month_over_month\nRetainers,18400,58%,6.2%\nProductised work,8950,28%,14.8%\nWorkshops,4420,14%,-3.1%\nTotal,31770,100%,8.4%",
    createdAt: now - day * 4,
    chatId: "chat_weekly",
    size: 2280,
  },
];

export const seedSettings: GeneralSettings = {
  name: "Alex Morgan",
  plan: "Studio plan",
  language: "English",
  theme: "light",
  fontSize: "default",
  chatFont: "default",
  enabledFormats: ["xlsx", "csv", "docx", "pdf", "html", "md", "json", "txt"],
  defaultFormat: "none",
  fileNamePattern: "heliovision-{date}-{slug}",
  keysLocked: false,
};

export const STARTER_SUGGESTIONS = [
  { label: "Write", prompt: "Help me write a warm, direct launch email for a small product update." },
  { label: "Learn", prompt: "Explain how retrieval-augmented generation works, with a simple analogy." },
  { label: "Code", prompt: "Review this function and suggest a cleaner, more resilient version." },
  { label: "Analyse", prompt: "Turn these weekly numbers into an Excel workbook with a short executive summary." },
  { label: "Life stuff", prompt: "Plan a calm, low-cost weekend in a city I have never visited." },
];
