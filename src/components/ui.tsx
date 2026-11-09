import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";

export function SunMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="3.1" fill="currentColor" opacity="0.95" />
      <circle cx="16" cy="16" r="7.2" stroke="currentColor" strokeWidth="1.15" opacity="0.55" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
        <line
          key={angle}
          x1="16"
          y1={i % 2 === 0 ? "2.3" : "3.6"}
          x2="16"
          y2={i % 2 === 0 ? "7.3" : "6.6"}
          stroke="currentColor"
          strokeWidth={i % 2 === 0 ? "1.5" : "1.15"}
          strokeLinecap="round"
          transform={`rotate(${angle} 16 16)`}
        />
      ))}
    </svg>
  );
}

export function Brand({ compact = false, size = 24 }: { compact?: boolean; size?: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="shrink-0 text-[var(--accent)]"><SunMark size={size} /></span>
      {!compact && <span className="truncate text-[16px] font-[500] tracking-[-0.025em] text-[var(--text)]">HelioVision<span className="text-[var(--accent-text)]">.Ai</span></span>}
    </div>
  );
}

export function Tip({ label, children, side = "bottom" }: { label: string; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <TooltipPrimitive.Root delayDuration={350}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={7}
          className="z-[100] max-w-[240px] animate-fade rounded-md border border-[var(--border)] bg-[var(--text)] px-2.5 py-1.5 text-[11.5px] leading-snug text-[var(--bg)] shadow-[var(--shadow-md)]"
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-[var(--text)]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function Menu({
  trigger,
  children,
  align = "start",
  side = "bottom",
  className = "",
  contentClassName = "",
  ariaLabel,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  contentClassName?: string;
  ariaLabel?: string;
}) {
  return (
    <DropdownPrimitive.Root modal={false}>
      <DropdownPrimitive.Trigger asChild>
        <button type="button" className={className} aria-label={ariaLabel}>{trigger}</button>
      </DropdownPrimitive.Trigger>
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content
          align={align}
          side={side}
          sideOffset={7}
          collisionPadding={12}
          className={`hv-popover z-[80] min-w-[190px] ${contentClassName}`}
        >
          {children}
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  );
}

export function MenuItem({
  children,
  icon,
  onSelect,
  shortcut,
  muted,
  danger,
  disabled,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  shortcut?: string;
  muted?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <DropdownPrimitive.Item
      disabled={disabled}
      onSelect={() => { onSelect?.(); }}
      className={`hv-menu-item outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 ${muted ? "text-[var(--text-muted-strong)]" : ""} ${danger ? "!text-[var(--danger)]" : ""}`}
    >
      {icon && <span className="flex size-4 items-center justify-center">{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="ml-4 font-sans text-[10.5px] tracking-wide text-[var(--text-muted)]">{shortcut}</span>}
    </DropdownPrimitive.Item>
  );
}

export function MenuSeparator() {
  return <DropdownPrimitive.Separator className="hv-divider" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.11em] text-[var(--text-muted)]">{children}</div>;
}

export function Modal({
  open,
  onClose,
  children,
  title,
  description,
  width = "720px",
  full = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  description?: string;
  width?: string;
  full?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Dialog"}>
      <button className="absolute inset-0 cursor-default bg-[rgba(20,20,19,0.4)] backdrop-blur-[2px]" onClick={onClose} aria-label="Close dialog" />
      <div className={`animate-slide-up relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] ${full ? "h-[92vh]" : ""}`} style={{ maxWidth: width }}>
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border-soft)] px-5 py-4 sm:px-6">
            <div className="min-w-0">
              {title && <h2 className="text-[16px] font-[500] tracking-[-0.01em]">{title}</h2>}
              {description && <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{description}</p>}
            </div>
            <Tip label="Close"><button onClick={onClose} className="hv-icon-btn -mr-1 -mt-1 shrink-0"><X size={17} strokeWidth={1.5} /></button></Tip>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-150 disabled:opacity-40 ${checked ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border)] bg-[var(--surface-hover)]"}`}
    >
      <span className={`absolute top-[2px] size-[16px] rounded-full bg-white shadow-sm transition-transform duration-150 ${checked ? "translate-x-[16px]" : "translate-x-[2px]"}`} />
    </button>
  );
}

export function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AM";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#cdb8a5] font-[500] text-[#3f332c] dark:bg-[#5d5047] dark:text-[#f6e9df]"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export function formatRelative(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function timeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[var(--surface-hover)] ${className}`} />;
}

export function StatusDot({ status }: { status: "connected" | "error" | "untested" | "ready" }) {
  const color = status === "connected" || status === "ready" ? "var(--success)" : status === "error" ? "var(--danger)" : "var(--text-muted)";
  return <span className="inline-block size-[6px] shrink-0 rounded-full" style={{ background: color }} />;
}
