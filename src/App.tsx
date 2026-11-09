import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { ArrowRight, Check, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatView } from "./components/ChatView";
import { ChatsPage, FilesPage, ProjectsPage } from "./components/Pages";
import { SettingsModal } from "./components/Settings";
import { CommandPalette } from "./components/CommandPalette";
import { Toasts } from "./components/Toasts";
import { Avatar, Brand, SunMark } from "./components/ui";
import { useWorkspace } from "./store/useWorkspace";
import { hasVault, openKeyVault } from "./lib/keyVault";
import { mirrorWorkspace } from "./lib/db";

function applyTheme(theme: "light" | "dark" | "system") {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#262624" : "#FAF9F5");
}

function LockScreen() {
  const { settings, unlockWorkspace, setAuthName, resetWorkspace, restoreProviderKeys, toast } = useWorkspace();
  const [email, setEmail] = useState(settings.name ? `${settings.name.toLowerCase().replace(/\s+/g, ".")}@local.workspace` : "you@local.workspace");
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passphrase.trim().length < 4) { setError("Enter your local passphrase (4+ characters) to continue."); return; }
    setLoading(true);
    setError("");
    if (settings.keysLocked && hasVault()) {
      const keys = await openKeyVault(passphrase);
      if (!keys) {
        setLoading(false);
        setError("That passphrase does not match this workspace. Try again.");
        return;
      }
      restoreProviderKeys(keys);
    }
    setAuthName(settings.name || email.split("@")[0]);
    unlockWorkspace();
    setLoading(false);
    toast("Workspace unlocked");
  };

  return (
    <div className="flex min-h-[100dvh] bg-[var(--bg)]">
      <div className="relative hidden w-[48%] flex-col justify-between overflow-hidden border-r border-[var(--border-soft)] bg-[var(--bg-sidebar)] p-10 lg:flex">
        <Brand size={25} />
        <div className="relative z-10 max-w-[410px]">
          <div className="mb-5 flex size-12 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[var(--accent-soft)] text-[var(--accent-text)]"><SunMark size={27} /></div>
          <h1 className="font-serif text-[43px] leading-[1.12] tracking-[-0.03em]">A quieter place for your best thinking.</h1>
          <p className="mt-4 max-w-[360px] font-serif text-[16px] leading-[1.7] text-[var(--text-muted-strong)]">Your own models, your own keys, and a workspace that stays entirely on this device.</p>
          <div className="mt-7 flex flex-wrap gap-2">
            {["No accounts", "No telemetry", "Local-first"].map((item) => <span key={item} className="flex items-center gap-1.5 rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1 text-[10px] text-[var(--text-muted-strong)]"><Check size={10} className="text-[var(--success)]" /> {item}</span>)}
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-2 text-[10.5px] text-[var(--text-muted)]"><ShieldCheck size={13} /> Keys are sent only to the providers you configure.</div>
        <div className="pointer-events-none absolute -bottom-[160px] -right-[120px] text-[color-mix(in_srgb,var(--accent)_8%,transparent)]"><SunMark size={520} /></div>
        <div className="pointer-events-none absolute right-16 top-24 size-[240px] rounded-full border border-[color-mix(in_srgb,var(--accent)_12%,transparent)]" />
      </div>
      <div className="flex min-h-[100dvh] flex-1 flex-col">
        <div className="flex items-center justify-between p-5 lg:hidden"><Brand size={23} /><span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]"><ShieldCheck size={12} /> Local workspace</span></div>
        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-10">
          <div className="w-full max-w-[375px] animate-slide-up">
            <div className="mb-8 lg:hidden"><div className="mb-4 flex size-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)]"><SunMark size={22} /></div><h1 className="font-serif text-[31px] leading-tight tracking-[-0.02em]">Welcome back{settings.name ? `, ${settings.name.split(" ")[0]}` : ""}.</h1></div>
            <div className="hidden lg:block"><div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">Private workspace</div><h2 className="font-serif text-[31px] leading-tight tracking-[-0.02em]">Welcome back{settings.name ? `, ${settings.name.split(" ")[0]}` : ""}.</h2><p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-muted)]">Your conversations and keys stayed right where you left them.</p></div>
            <div className="mt-7 flex items-center gap-3 rounded-[11px] border border-[var(--border-soft)] bg-[var(--surface)] p-3">
              <Avatar name={settings.name || "Alex Morgan"} size={38} />
              <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-[450]">{settings.name || "Alex Morgan"}</div><div className="truncate text-[10.5px] text-[var(--text-muted)]">{settings.plan || "Studio plan"} · local profile</div></div>
              <span className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--success)_9%,transparent)] px-2 py-1 text-[9px] font-medium text-[var(--success)]"><span className="size-[4px] rounded-full bg-[var(--success)]" /> Saved</span>
            </div>
            <form onSubmit={submit} className="mt-4">
              <label className="hv-label" htmlFor="auth-email">Email</label>
              <input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="hv-input" autoComplete="username" />
              <div className="mt-3"><div className="mb-1.5 flex items-center justify-between"><label className="!mb-0 text-[12px] font-[500] text-[var(--text-muted-strong)]" htmlFor="auth-pass">Workspace passphrase</label><button type="button" onClick={() => setPassphrase("heliovision")} className="text-[10px] text-[var(--accent-text)] hover:underline">Use demo passphrase</button></div><div className="relative"><KeyRound size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input id="auth-pass" type="password" value={passphrase} onChange={(e) => { setPassphrase(e.target.value); setError(""); }} placeholder="Enter your local passphrase" className="hv-input pl-9" autoComplete="current-password" /></div></div>
              {error && <p className="mt-2 text-[11px] text-[var(--danger)]">{error}</p>}
              <button type="submit" disabled={loading} className="hv-btn hv-btn-primary mt-4 !h-10 w-full text-[12.5px]">{loading ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <>{settings.keysLocked ? "Unlock workspace" : "Continue to workspace"}<ArrowRight size={15} /></>}</button>
            </form>
            <div className="mt-5 flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--code-bg)] p-2.5 text-[10px] leading-relaxed text-[var(--text-muted)]"><LockKeyhole size={13} className="shrink-0" /><span>{settings.keysLocked ? "Protected by your local vault. Keys are decrypted only in this browser." : "This is a local-first demo account. Your passphrase is never sent to a server."}</span></div>
            <button onClick={() => { if (confirm("Start a fresh local workspace? This clears the seeded chats and providers.")) { resetWorkspace(); unlockWorkspace(); } }} className="mx-auto mt-4 block text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-text)]">Start a fresh local workspace</button>
            <p className="mt-6 text-center text-[9.5px] text-[var(--text-muted)]">HelioVision.Ai · your private thinking space</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { signedIn, page, settings, setCommandOpen, commandOpen, newChat, toggleSidebar, openSettings } = useWorkspace();
  const [mobileSidebar, setMobileSidebar] = useState(false);

  useEffect(() => {
    applyTheme(settings.theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { if (useWorkspace.getState().settings.theme === "system") applyTheme("system"); };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.dataset.size = settings.fontSize;
  }, [settings.fontSize]);

  // Mirror the reactive workspace into the versioned local database.
  useEffect(() => {
    let timer = 0;
    const unsubscribe = useWorkspace.subscribe((state, previous) => {
      if (!state.signedIn) return;
      if (
        state.chats === previous.chats && state.messages === previous.messages &&
        state.providers === previous.providers && state.models === previous.models &&
        state.projects === previous.projects && state.files === previous.files &&
        state.settings === previous.settings
      ) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void mirrorWorkspace({
          providers: state.providers, models: state.models, chats: state.chats,
          messages: state.messages, projects: state.projects, files: state.files,
          settings: state.settings as unknown as Record<string, unknown>,
        });
      }, 400);
    });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(!useWorkspace.getState().commandOpen); }
      else if (meta && event.shiftKey && event.key.toLowerCase() === "o") { event.preventDefault(); newChat(); setMobileSidebar(false); }
      else if (meta && event.key.toLowerCase() === "b") { event.preventDefault(); toggleSidebar(); }
      else if (meta && event.key === "/") { event.preventDefault(); openSettings("shortcuts"); }
      else if (event.key === "Escape") {
        if (useWorkspace.getState().commandOpen) setCommandOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [newChat, setCommandOpen, toggleSidebar, openSettings]);

  if (!signedIn) return <TooltipPrimitive.Provider delayDuration={300}><LockScreen /><Toasts /></TooltipPrimitive.Provider>;

  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-[var(--bg)] text-[var(--text)]" data-command-open={commandOpen}>
        <Sidebar mobileOpen={mobileSidebar} onCloseMobile={() => setMobileSidebar(false)} />
        <main className="flex min-h-0 min-w-0 flex-1 bg-[var(--bg)]">
          {page === "chat" && <ChatView onOpenMobile={() => setMobileSidebar(true)} />}
          {page === "chats" && <ChatsPage onOpenMobile={() => setMobileSidebar(true)} />}
          {page === "projects" && <ProjectsPage onOpenMobile={() => setMobileSidebar(true)} />}
          {page === "files" && <FilesPage onOpenMobile={() => setMobileSidebar(true)} />}
        </main>
        <SettingsModal />
        <CommandPalette />
        <Toasts />
      </div>
    </TooltipPrimitive.Provider>
  );
}
