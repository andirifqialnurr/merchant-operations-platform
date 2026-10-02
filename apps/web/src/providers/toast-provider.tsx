"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { ToastStack, type ToastItem } from "@merchant/ui/feedback";

type Notify = (toast: { message: string; tone: "success" | "danger" }) => void;

const ToastContext = createContext<Notify>(() => undefined);
const SUCCESS_DURATION_MS = 4_000;

/** Success toasts dismiss themselves; errors stay until the user closes them. */
export function ToastProvider({
  children,
  dismissLabel,
}: Readonly<{ children: ReactNode; dismissLabel: string }>) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback<Notify>(
    ({ message, tone }) => {
      nextId.current += 1;
      const id = String(nextId.current);
      setItems((current) => [
        { dismissLabel, id, message, onDismiss: () => dismiss(id), tone },
        ...current,
      ]);
      if (tone === "success") window.setTimeout(() => dismiss(id), SUCCESS_DURATION_MS);
    },
    [dismiss, dismissLabel],
  );

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack items={items} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
