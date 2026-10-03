"use client";

import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { IconX } from "@tabler/icons-react";
import { AppIcon } from "./app-icon";
import { Button } from "./button";

/*
 * Label props default to Indonesian until the i18n checkpoint moves every
 * default into the id/en dictionaries.
 */
export type DialogSize = "xs" | "sm" | "md" | "lg" | "xl" | "full";
export type SheetSize = "sm" | "md" | "lg";
export type DialogProps = {
  children: ReactNode;
  /** Accessible name of the close button. */
  closeLabel: string;
  description?: string;
  footer?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  size?: DialogSize;
  title: string;
};
export type AlertDialogProps = Omit<DialogProps, "footer"> & {
  cancelLabel: string;
  confirmLabel: string;
  /** Destructive by default; set false for a neutral confirmation. */
  destructive?: boolean;
  onConfirm: () => void;
};
export type SheetProps = {
  children: ReactNode;
  closeLabel: string;
  footer?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** Edge the sheet slides from on wider screens. Navigation drawers use `start`. */
  side?: "start" | "end";
  size?: SheetSize;
  title: string;
};
export type PopoverProps = {
  /** Edge of the trigger the content aligns to. */
  align?: "start" | "end";
  children: ReactNode;
  content: ReactNode;
  /** Accessible name of the trigger when its content is not text. */
  label?: string;
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
/** Closes a non-modal layer on outside press or Escape. */
function useDismiss(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  onDismiss: (reason: "escape" | "outside") => void,
) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onDismissRef.current("outside");
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onDismissRef.current("escape");
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, rootRef]);
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
      <div className="ui-overlay__panel" onKeyDown={trap} ref={panelRef}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
export function Dialog({
  children,
  closeLabel,
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
          <button
            aria-label={closeLabel}
            className="ui-overlay__close"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <AppIcon icon={IconX} size="sm" />
          </button>
        </header>
        <div className="ui-dialog__body">{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </section>
    </Overlay>
  );
}
export function AlertDialog({
  cancelLabel,
  confirmLabel,
  destructive = true,
  onConfirm,
  onOpenChange,
  size = "xs",
  ...props
}: AlertDialogProps) {
  return (
    <Dialog
      {...props}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} variant="secondary">
            {cancelLabel}
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            variant={destructive ? "destructive" : "primary"}
          >
            {confirmLabel}
          </Button>
        </>
      }
      onOpenChange={onOpenChange}
      size={size}
    />
  );
}
export function Sheet({
  children,
  closeLabel,
  footer,
  onOpenChange,
  open,
  side = "end",
  size = "md",
  title,
}: SheetProps) {
  const titleId = useId();
  return (
    <Overlay onClose={() => onOpenChange(false)} open={open}>
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={`ui-sheet ui-sheet--${size} ui-sheet--${side}`}
        role="dialog"
      >
        <header>
          <h2 id={titleId}>{title}</h2>
          <button
            aria-label={closeLabel}
            className="ui-overlay__close"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <AppIcon icon={IconX} size="sm" />
          </button>
        </header>
        <div className="ui-sheet__body">{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </section>
    </Overlay>
  );
}
export function Popover({
  align = "start",
  children,
  content,
  label,
  onOpenChange,
  open,
}: PopoverProps) {
  const controlled = open !== undefined;
  const rootRef = useRef<HTMLDivElement>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const visible = controlled ? open : uncontrolledOpen;
  function toggle(next: boolean) {
    if (!controlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }
  useDismiss(visible, rootRef, () => toggle(false));
  return (
    <div className="ui-popover" ref={rootRef}>
      <button
        aria-expanded={visible}
        aria-haspopup="dialog"
        aria-label={label}
        onClick={() => toggle(!visible)}
        type="button"
      >
        {children}
      </button>
      {visible ? (
        <div
          aria-label={label}
          className={`ui-popover__content ui-popover__content--${align}`}
          role="dialog"
        >
          {content}
        </div>
      ) : null}
    </div>
  );
}
export function DropdownMenu({ items, label, trigger }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useDismiss(open, rootRef, (reason) => {
    setOpen(false);
    if (reason === "escape") triggerRef.current?.focus();
  });
  function menuItems() {
    return Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
        [],
    );
  }
  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const targets = menuItems();
    if (!targets.length) return;
    const current = targets.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? targets.length - 1
          : (current + (event.key === "ArrowDown" ? 1 : -1) + targets.length) % targets.length;
    targets[next]?.focus();
  }
  return (
    <span className="ui-popover" onKeyDown={onKeyDown} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        ref={triggerRef}
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
                triggerRef.current?.focus();
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
  const id = useId();
  return (
    <span aria-describedby={id} className="ui-tooltip" tabIndex={0}>
      {children}
      <span id={id} role="tooltip">
        {content}
      </span>
    </span>
  );
}
