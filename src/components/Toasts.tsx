import { Check, X } from "lucide-react";
import { useWorkspace } from "../store/useWorkspace";

export function Toasts() {
  const { toasts, dismissToast } = useWorkspace();
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(196px,calc(env(safe-area-inset-bottom)+186px))] sm:bottom-[max(30px,env(safe-area-inset-bottom))] z-[95] flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto flex max-w-[420px] animate-slide-up items-center gap-2.5 rounded-[10px] border border-[color-mix(in_srgb,var(--bg)_12%,transparent)] bg-[var(--text)] py-2 pl-3 pr-2 text-[12px] text-[var(--bg)] shadow-[var(--shadow-lg)]" role="status">
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--bg)_18%,transparent)]"><Check size={10} strokeWidth={2} /></span>
          <span className="min-w-0 flex-1">{toast.message}</span>
          {toast.action && <button onClick={() => { toast.action?.onClick(); dismissToast(toast.id); }} className="shrink-0 rounded px-2 py-0.5 text-[11px] font-[450] text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--bg)_10%,transparent)]">{toast.action.label}</button>}
          <button onClick={() => dismissToast(toast.id)} className="flex size-6 shrink-0 items-center justify-center rounded text-[color-mix(in_srgb,var(--bg)_65%,transparent)] hover:bg-[color-mix(in_srgb,var(--bg)_10%,transparent)]" aria-label="Dismiss"><X size={12} /></button>
        </div>
      ))}
    </div>
  );
}
