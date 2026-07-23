"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AppIcon } from "./app-icon";

export type DialogSize = "xs" | "sm" | "md" | "lg" | "xl" | "full";
export type SheetSize = "sm" | "md" | "lg";
export type DialogProps = {
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  size?: DialogSize;
  title: string;
};
export type AlertDialogProps = DialogProps & { confirmLabel: string; onConfirm: () => void };
export type SheetProps = {
  children: ReactNode;
  footer?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  size?: SheetSize;
  title: string;
};
export type PopoverProps = {
  children: ReactNode;
  content: ReactNode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
};
export type DropdownItem = {
  destructive?: boolean;
  disabled?: boolean;
  label: string;
  onSelect: () => void;
};
export type DropdownMenuProps = {
  items: readonly DropdownItem[];
  label: string;
  trigger: ReactNode;
};
export type TooltipProps = { children: ReactNode; content: string };

function focusable(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  );
}
function Overlay({
  children,
  onClose,
  open,
}: {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    previous.current = document.activeElement as HTMLElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => focusable(panelRef.current!)[0]?.focus(), 0);
    function escape(event: KeyboardEvent | globalThis.KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", escape);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener("keydown", escape);
      previous.current?.focus();
    };
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  function trap(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const targets = focusable(panelRef.current!);
    if (!targets.length) return;
    const first = targets[0]!;
    const last = targets.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  return createPortal(
    <div
      className="ui-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div onKeyDown={trap} ref={panelRef}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
export function Dialog({
  children,
  description,
  footer,
  onOpenChange,
  open,
  size = "md",
  title,
}: DialogProps) {
  const titleId = useId();
  return (
    <Overlay onClose={() => onOpenChange(false)} open={open}>
      <section
        aria-describedby={description ? `${titleId}-description` : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`ui-dialog ui-dialog--${size}`}
        role="dialog"
      >
        <header>
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={`${titleId}-description`}>{description}</p> : null}
          </div>
          <button aria-label="Tutup dialog" onClick={() => onOpenChange(false)} type="button">
            <AppIcon icon={X} size="sm" />
          </button>
        </header>
        <div className="ui-dialog__body">{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </section>
    </Overlay>
  );
}
export function AlertDialog({ confirmLabel, onConfirm, onOpenChange, ...props }: AlertDialogProps) {
  return (
    <Dialog
      {...props}
      footer={
        <>
          <button onClick={() => onOpenChange(false)} type="button">
            Batal
          </button>
          <button
            className="ui-overlay__destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            type="button"
          >
            {confirmLabel}
          </button>
        </>
      }
      onOpenChange={onOpenChange}
    />
  );
}
export function Sheet({ children, footer, onOpenChange, open, size = "md", title }: SheetProps) {
  return (
    <Overlay onClose={() => onOpenChange(false)} open={open}>
      <section
        aria-modal="true"
        aria-label={title}
        className={`ui-sheet ui-sheet--${size}`}
        role="dialog"
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="Tutup panel" onClick={() => onOpenChange(false)} type="button">
            <AppIcon icon={X} size="sm" />
          </button>
        </header>
        <div className="ui-sheet__body">{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </section>
    </Overlay>
  );
}
export function Popover({ children, content, onOpenChange, open }: PopoverProps) {
  const controlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const visible = controlled ? open : uncontrolledOpen;
  function toggle(next: boolean) {
    if (!controlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }
  return (
    <span className="ui-popover">
      <button aria-expanded={visible} onClick={() => toggle(!visible)} type="button">
        {children}
      </button>
      {visible ? (
        <span className="ui-popover__content" role="dialog">
          {content}
        </span>
      ) : null}
    </span>
  );
}
export function DropdownMenu({ items, label, trigger }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <span className="ui-popover">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {trigger}
      </button>
      {open ? (
        <span aria-label={label} className="ui-dropdown" role="menu">
          {items.map((item) => (
            <button
              className={item.destructive ? "ui-dropdown__item--destructive" : undefined}
              disabled={item.disabled}
              key={item.label}
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
              role="menuitem"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
export function Tooltip({ children, content }: TooltipProps) {
  return (
    <span className="ui-tooltip" tabIndex={0}>
      {children}
      <span role="tooltip">{content}</span>
    </span>
  );
}
