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

  // Track danger toasts for dismiss shortcut
  const dangerStackRef = useRef<number[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, show: false } : t));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
    // Remove from stacks
    actionStackRef.current = actionStackRef.current.filter((a) => a.id !== id);
    dangerStackRef.current = dangerStackRef.current.filter((i) => i !== id);
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

    if (opts?.danger) {
      dangerStackRef.current.push(id);
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
      const tag = (document.activeElement?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // 'q' dismisses the most recent danger toast
      if (key === "q") {
        const dangerStack = dangerStackRef.current;
        if (dangerStack.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          const id = dangerStack[dangerStack.length - 1];
          removeToast(id);
          return;
        }
      }

      // Action shortcut keys (z for undo, etc)
      const stack = actionStackRef.current;
      if (stack.length === 0) return;

      // Find the most recent (last) actionable toast matching this shortcut key
      for (let i = stack.length - 1; i >= 0; i--) {
        const entry = stack[i];
        if (entry.action.shortcutKey && key === entry.action.shortcutKey) {
          e.preventDefault();
          e.stopPropagation();
          entry.action.onClick();
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
            {toast.danger && (
              <button
                class="toast-dismiss"
                onClick={() => removeToast(toast.id)}
                title="Dismiss (q)"
                aria-label="Dismiss"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <kbd>q</kbd>
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
