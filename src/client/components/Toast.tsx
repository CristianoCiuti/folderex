import { createContext } from "preact";
import { useState, useCallback, useContext, useRef, useEffect } from "preact/hooks";
import type { ComponentChildren } from "preact";

interface ToastAction {
  label: string;
  shortcutKey?: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  message: string;
  action?: ToastAction;
  danger?: boolean;
  duration: number;
  show: boolean;
}

interface ToastContextValue {
  showToast: (message: string, opts?: {
    duration?: number;
    danger?: boolean;
    action?: ToastAction;
  }) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ComponentChildren }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Stack of actionable toasts (LIFO) — most recent at end
  const actionStackRef = useRef<{ id: number; action: ToastAction }[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, show: false } : t));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
    // Remove from action stack
    actionStackRef.current = actionStackRef.current.filter((a) => a.id !== id);
  }, []);

  const showToast = useCallback((message: string, opts?: {
    duration?: number;
    danger?: boolean;
    action?: ToastAction;
  }) => {
    const id = nextId++;
    const duration = opts?.duration || 2500;
    const toast: ToastItem = {
      id,
      message,
      action: opts?.action,
      danger: opts?.danger,
      duration,
      show: false,
    };

    if (opts?.action) {
      actionStackRef.current.push({ id, action: opts.action });
    }

    setToasts((prev) => {
      const next = [...prev, toast];
      // Limit visible toasts to 5 (allow more for multi-delete)
      if (next.length > 5) {
        return next.slice(next.length - 5);
      }
      return next;
    });

    // Force reflow then show
    requestAnimationFrame(() => {
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, show: true } : t));
    });

    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, [removeToast]);

  // Global keyboard handler for actionable toast shortcuts (LIFO stack)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const stack = actionStackRef.current;
      if (stack.length === 0) return;
      const tag = (document.activeElement?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();
      // Find the most recent (last) actionable toast matching this shortcut key
      for (let i = stack.length - 1; i >= 0; i--) {
        const entry = stack[i];
        if (entry.action.shortcutKey && key === entry.action.shortcutKey) {
          e.preventDefault();
          e.stopPropagation();
          entry.action.onClick();
          // Remove this toast from display and stack
          removeToast(entry.id);
          return;
        }
      }
    };

    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div class="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            class={`toast${toast.show ? " show" : ""}${toast.action ? " toast-actionable" : ""}${toast.danger ? " toast-danger" : ""}`}
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                class="toast-undo"
                onClick={() => {
                  toast.action!.onClick();
                  removeToast(toast.id);
                }}
              >
                {toast.action.label}
                {toast.action.shortcutKey && (
                  <span class="toast-shortcut">{toast.action.shortcutKey}</span>
                )}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
