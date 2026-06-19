import { randomUUID } from "crypto";
import { Worker } from "worker_threads";
import { join, dirname } from "path";
import { readdirSync, statSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import type { WebSocketServer, WebSocket } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type OpStatus = "active" | "done" | "error" | "cancelled";
export type OpType = "clone" | "delete" | "upload";

export interface ServerOperation {
  id: string;
  type: OpType;
  label: string;
  status: OpStatus;
  progress: number; // 0-100
  totalBytes: number;
  processedBytes: number;
  startedAt: number;
  completedAt: number | null;
  error: string | null;
}

interface InternalOp extends ServerOperation {
  worker: Worker | null;
  // For polling: what to measure
  polling?: {
    mode: "copy-growth" | "delete-shrink";
    targetPath: string;    // path to measure
    initialBytes: number;  // starting size (for delete: original size; for copy: 0)
    goalBytes: number;     // target size (for copy: source size; for delete: 0)
  };
}

/** Recursively calculate total size of a path */
function measureSize(fsPath: string): number {
  try {
    const stat = statSync(fsPath);
    if (!stat.isDirectory()) return stat.size;
    let total = 0;
    const entries = readdirSync(fsPath);
    for (const name of entries) {
      total += measureSize(join(fsPath, name));
    }
    return total;
  } catch {
    return 0;
  }
}

export class OperationsManager {
  private ops = new Map<string, InternalOp>();
  private wss: WebSocketServer | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  setWss(wss: WebSocketServer) {
    this.wss = wss;
  }

  list(): ServerOperation[] {
    const all = Array.from(this.ops.values()).map(({ worker, polling, ...rest }) => rest);
    all.sort((a, b) => b.startedAt - a.startedAt);
    return all;
  }

  get(id: string): ServerOperation | undefined {
    const op = this.ops.get(id);
    if (!op) return undefined;
    const { worker, polling, ...rest } = op;
    return rest;
  }

  cancel(id: string): boolean {
    const op = this.ops.get(id);
    if (!op || op.status !== "active") return false;

    // Terminate the worker thread — this kills cpSync/rmSync mid-operation
    if (op.worker) {
      op.worker.terminate();
      op.worker = null;
    }

    op.status = "cancelled";
    op.completedAt = Date.now();
    op.error = "Cancelled by user";
    this.broadcast(op);
    this.checkPolling();
    return true;
  }

  /**
   * Run a clone operation in a worker thread with polling-based progress.
   */
  runClone(src: string, dest: string, label: string): string {
    const id = randomUUID();
    const sourceBytes = measureSize(src);

    const op: InternalOp = {
      id, type: "clone", label,
      status: "active", progress: 0,
      totalBytes: sourceBytes, processedBytes: 0,
      startedAt: Date.now(), completedAt: null, error: null,
      worker: null,
      polling: {
        mode: "copy-growth",
        targetPath: dest,
        initialBytes: 0,
        goalBytes: sourceBytes,
      },
    };

    this.ops.set(id, op);
    this.broadcast(op);
    this.startWorker(op, { task: "clone", src, dest });
    this.ensurePolling();
    return id;
  }

  /**
   * Run a delete operation (cross-device trash: copy to trash, then rm original)
   * in a worker thread with polling-based progress.
   */
  runDelete(src: string, trashDest: string, label: string): string {
    const id = randomUUID();
    const sourceBytes = measureSize(src);

    const op: InternalOp = {
      id, type: "delete", label,
      status: "active", progress: 0,
      totalBytes: sourceBytes, processedBytes: 0,
      startedAt: Date.now(), completedAt: null, error: null,
      worker: null,
      polling: {
        mode: "copy-growth",
        targetPath: trashDest,
        initialBytes: 0,
        goalBytes: sourceBytes,
      },
    };

    this.ops.set(id, op);
    this.broadcast(op);
    this.startWorker(op, { task: "delete", src, trashDest });
    this.ensurePolling();
    return id;
  }

  /**
   * Create a tracked operation for things that don't need a worker (instant ops, uploads).
   */
  create(type: OpType, label: string, id?: string): string {
    const opId = id || randomUUID();
    const op: InternalOp = {
      id: opId, type, label,
      status: "active", progress: 0,
      totalBytes: 0, processedBytes: 0,
      startedAt: Date.now(), completedAt: null, error: null,
      worker: null,
    };
    this.ops.set(opId, op);
    this.broadcast(op);
    return opId;
  }

  complete(id: string, error?: string) {
    const op = this.ops.get(id);
    if (!op) return;
    op.status = error ? "error" : "done";
    op.completedAt = Date.now();
    op.error = error || null;
    if (!error) { op.progress = 100; op.processedBytes = op.totalBytes; }
    op.worker = null;
    this.broadcast(op);
    this.checkPolling();
    // Notify clients to refresh file list after operation completes
    this.broadcastFsChange();
  }

  clearCompleted() {
    for (const [id, op] of this.ops) {
      if (op.status !== "active") {
        this.ops.delete(id);
      }
    }
  }

  // --- Internal ---

  private startWorker(op: InternalOp, data: Record<string, string>) {
    const workerPath = join(__dirname, "operations-worker.js");
    const worker = new Worker(workerPath, { workerData: data });
    op.worker = worker;

    worker.on("message", (msg: { type: string; error?: string; trashToken?: string }) => {
      if (msg.type === "done") {
        this.complete(op.id);
      } else if (msg.type === "error") {
        this.complete(op.id, msg.error || "Unknown error");
      }
    });

    worker.on("error", (err) => {
      this.complete(op.id, err.message);
    });

    worker.on("exit", (code) => {
      // If the op is still active, it was terminated (cancelled)
      if (op.status === "active" && code !== 0) {
        // Already handled by cancel()
      }
    });
  }

  /** Single polling loop for all active operations — runs every 1s */
  private ensurePolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.pollAll(), 1000);
  }

  private checkPolling() {
    const hasActive = Array.from(this.ops.values()).some(
      (op) => op.status === "active" && op.polling
    );
    if (!hasActive && this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private pollAll() {
    for (const op of this.ops.values()) {
      if (op.status !== "active" || !op.polling) continue;

      const { mode, targetPath, goalBytes } = op.polling;
      let currentBytes: number;

      try {
        currentBytes = existsSync(targetPath) ? measureSize(targetPath) : 0;
      } catch {
        continue;
      }

      if (mode === "copy-growth") {
        op.processedBytes = currentBytes;
        op.progress = goalBytes > 0 ? Math.min(99, Math.round((currentBytes / goalBytes) * 100)) : 0;
      } else if (mode === "delete-shrink") {
        const deleted = op.polling.initialBytes - currentBytes;
        op.processedBytes = deleted;
        op.progress = op.polling.initialBytes > 0
          ? Math.min(99, Math.round((deleted / op.polling.initialBytes) * 100))
          : 0;
      }

      this.broadcast(op);
    }
  }

  private broadcast(op: InternalOp) {
    if (!this.wss) return;
    const { worker, polling, ...payload } = op;
    const msg = JSON.stringify({ type: "operation", operation: payload });
    for (const client of this.wss.clients) {
      if ((client as WebSocket).readyState === 1) {
        client.send(msg);
      }
    }
  }

  private broadcastFsChange() {
    if (!this.wss) return;
    const msg = JSON.stringify({ type: "fschange" });
    for (const client of this.wss.clients) {
      if ((client as WebSocket).readyState === 1) {
        client.send(msg);
      }
    }
  }
}
