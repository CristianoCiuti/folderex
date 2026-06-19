import { createContext } from "preact";
import { useState, useCallback, useContext } from "preact/hooks";

export type OperationStatus = "active" | "done" | "error" | "cancelled";
export type OperationType = "clone" | "delete" | "upload";

export interface ServerOperation {
  id: string;
  type: OperationType;
  label: string;
  status: OperationStatus;
  progress: number;
  totalBytes: number;
  processedBytes: number;
  startedAt: number;
  completedAt: number | null;
  error: string | null;
}

// Client-only operations (uploads tracked via XHR)
export interface ClientOperation {
  id: string;
  type: "upload";
  label: string;
  status: OperationStatus;
  progress: number;
  startedAt: number;
  completedAt: number | null;
  error: string | null;
  abort: (() => void) | null;
}

export type Operation = (ServerOperation | ClientOperation) & { source: "server" | "client" };

interface OperationsContextValue {
  operations: Operation[];
  // Server operations (received via WebSocket)
  handleServerOperation: (op: ServerOperation) => void;
  handleOperationsSync: (ops: ServerOperation[]) => void;
  // Client operations (uploads)
  addClientOperation: (op: Omit<ClientOperation, "id" | "startedAt" | "completedAt" | "error">) => string;
  updateClientOperation: (id: string, updates: Partial<Pick<ClientOperation, "progress" | "status" | "label" | "error">>) => void;
  completeClientOperation: (id: string, error?: string) => void;
  removeClientOperation: (id: string) => void;
  // Cancel (works for both - server via API, client via abort)
  cancelOperation: (id: string) => void;
  clearCompleted: () => void;
}

export const OperationsContext = createContext<OperationsContextValue>({
  operations: [],
  handleServerOperation: () => {},
  handleOperationsSync: () => {},
  addClientOperation: () => "",
  updateClientOperation: () => {},
  completeClientOperation: () => {},
  removeClientOperation: () => {},
  cancelOperation: () => {},
  clearCompleted: () => {},
});

let clientOpId = 0;

export function useOperationsProvider() {
  const [operations, setOperations] = useState<Operation[]>([]);

  const handleServerOperation = useCallback((op: ServerOperation) => {
    setOperations((prev) => {
      const entry: Operation = { ...op, source: "server" };
      // Remove any existing op with this ID (client or server) to prevent duplicates
      const without = prev.filter((o) => o.id !== op.id);
      // Insert in position by startedAt
      const idx = without.findIndex((o) => o.startedAt < entry.startedAt);
      if (idx === -1) {
        return [...without, entry];
      }
      const next = [...without];
      next.splice(idx, 0, entry);
      return next;
    });
  }, []);

  const handleOperationsSync = useCallback((ops: ServerOperation[]) => {
    setOperations((prev) => {
      const serverOps = ops.map((op): Operation => ({ ...op, source: "server" }));
      const serverIds = new Set(serverOps.map((o) => o.id));
      // Keep client ops that don't have a server counterpart (active uploads in progress)
      const clientOnly = prev.filter((o) => o.source === "client" && !serverIds.has(o.id));
      return [...serverOps, ...clientOnly].sort((a, b) => b.startedAt - a.startedAt);
    });
  }, []);

  const addClientOperation = useCallback((op: Omit<ClientOperation, "id" | "startedAt" | "completedAt" | "error">): string => {
    const id = `client-${++clientOpId}-${Date.now()}`;
    const entry: Operation = {
      ...op,
      id,
      startedAt: Date.now(),
      completedAt: null,
      error: null,
      source: "client",
    };
    setOperations((prev) => [entry, ...prev]);
    return id;
  }, []);

  const updateClientOperation = useCallback((id: string, updates: Partial<Pick<ClientOperation, "progress" | "status" | "label" | "error">>) => {
    setOperations((prev) =>
      prev.map((op) => {
        if (op.id !== id) return op;
        const updated = { ...op, ...updates };
        if (updates.status === "done" || updates.status === "error") {
          updated.completedAt = Date.now();
        }
        return updated;
      })
    );
  }, []);

  const completeClientOperation = useCallback((id: string, error?: string) => {
    setOperations((prev) =>
      prev.map((op) => {
        if (op.id !== id) return op;
        return {
          ...op,
          status: (error ? "error" : "done") as OperationStatus,
          progress: error ? op.progress : 100,
          completedAt: Date.now(),
          error: error || null,
        };
      })
    );
  }, []);

  const removeClientOperation = useCallback((id: string) => {
    setOperations((prev) => prev.filter((op) => op.id !== id));
  }, []);

  const cancelOperation = useCallback((id: string) => {
    setOperations((prev) => {
      const op = prev.find((o) => o.id === id);
      if (!op || op.status !== "active") return prev;

      if (op.source === "client" && "abort" in op && op.abort) {
        op.abort();
      }

      if (op.source === "server") {
        // Send cancel to server
        fetch(`/__api/operations/${id}/cancel`, { method: "POST" }).catch(() => {});
      }

      return prev.map((o) =>
        o.id === id
          ? { ...o, status: "cancelled" as OperationStatus, completedAt: Date.now(), error: "Cancelled" }
          : o
      );
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setOperations((prev) => prev.filter((op) => op.status === "active"));
    // Clear server-side history too
    fetch("/__api/operations", { method: "DELETE" }).catch(() => {});
  }, []);

  return {
    operations,
    handleServerOperation,
    handleOperationsSync,
    addClientOperation,
    updateClientOperation,
    completeClientOperation,
    removeClientOperation,
    cancelOperation,
    clearCompleted,
  };
}

export function useOperations() {
  return useContext(OperationsContext);
}
