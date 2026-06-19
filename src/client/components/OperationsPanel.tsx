import { useState, useEffect } from "preact/hooks";
import { useOperations } from "../hooks/useOperations";
import type { Operation } from "../hooks/useOperations";

function formatElapsed(startedAt: number, completedAt: number | null): string {
  const end = completedAt || Date.now();
  const seconds = Math.floor((end - startedAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function OpIcon({ type }: { type: string }) {
  switch (type) {
    case "upload":
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
    case "clone":
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
    case "delete":
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
    default:
      return null;
  }
}

function StatusIndicator({ status }: { status: string }) {
  switch (status) {
    case "active":
      return <span class="ops-status-spinner" />;
    case "done":
      return (
        <svg class="ops-status-done" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case "error":
    case "cancelled":
      return (
        <svg class="ops-status-error" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    default:
      return null;
  }
}

function OperationRow({ op, onCancel }: { op: Operation; onCancel: (id: string) => void }) {
  const [elapsed, setElapsed] = useState(formatElapsed(op.startedAt, op.completedAt));

  useEffect(() => {
    if (op.status !== "active") {
      setElapsed(formatElapsed(op.startedAt, op.completedAt));
      return;
    }
    const interval = setInterval(() => {
      setElapsed(formatElapsed(op.startedAt, null));
    }, 1000);
    return () => clearInterval(interval);
  }, [op.status, op.startedAt, op.completedAt]);

  const hasProgress = op.status === "active" && op.progress > 0;
  const isIndeterminate = op.status === "active" && op.progress === 0;
  const hasBytes = "totalBytes" in op && (op as any).totalBytes > 0 && op.status === "active";

  return (
    <div class={`ops-row ops-row-${op.status}`}>
      <span class="ops-row-icon"><OpIcon type={op.type} /></span>
      <span class="ops-row-label" title={op.label}>{op.label}</span>
      {hasProgress && (
        <span class="ops-row-progress-wrap">
          <span class="ops-row-progress-bar">
            <span class="ops-row-progress-fill" style={{ width: `${op.progress}%` }} />
          </span>
          <span class="ops-row-pct">{Math.round(op.progress)}%</span>
        </span>
      )}
      {isIndeterminate && (
        <span class="ops-row-progress-wrap">
          <span class="ops-row-progress-bar indeterminate" />
        </span>
      )}
      {hasBytes && (
        <span class="ops-row-files">
          {formatBytes((op as any).processedBytes)}/{formatBytes((op as any).totalBytes)}
        </span>
      )}
      <span class="ops-row-elapsed">{elapsed}</span>
      <span class="ops-row-status"><StatusIndicator status={op.status} /></span>
      {op.status === "active" && (
        <button
          class="ops-row-cancel"
          onClick={() => onCancel(op.id)}
          title="Cancel"
          aria-label={`Cancel ${op.label}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
      {op.error && op.status !== "active" && (
        <span class="ops-row-error-msg" title={op.error}>{op.error}</span>
      )}
    </div>
  );
}

export function OperationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { operations, cancelOperation, clearCompleted } = useOperations();
  const [expanded, setExpanded] = useState(true);

  const activeOps = operations.filter((op) => op.status === "active");
  const completedOps = operations.filter((op) => op.status !== "active");
  const hasOps = operations.length > 0;

  // Auto-open when a new active operation starts
  // (The parent controls open state, but we don't force it here)

  if (!open || !hasOps) return null;

  return (
    <div class={`ops-panel${expanded ? " expanded" : ""}`}>
      <div class="ops-panel-header" onClick={() => setExpanded(!expanded)}>
        <span class="ops-panel-title">
          {activeOps.length > 0
            ? `${activeOps.length} operation${activeOps.length > 1 ? "s" : ""} in progress`
            : `${completedOps.length} operation${completedOps.length > 1 ? "s" : ""} completed`
          }
        </span>
        <span class="ops-panel-actions">
          {completedOps.length > 0 && activeOps.length === 0 && (
            <button
              class="ops-panel-clear"
              onClick={(e) => { e.stopPropagation(); clearCompleted(); }}
              title="Clear history"
              aria-label="Clear completed operations"
            >
              Clear
            </button>
          )}
          <svg class="ops-panel-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </span>
      </div>
      {expanded && (
        <div class="ops-panel-body">
          {operations.map((op) => (
            <OperationRow key={op.id} op={op} onCancel={cancelOperation} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Toggle button for footer - shows activity indicator when ops are active */
export function OperationsToggle({ onClick }: { onClick: () => void }) {
  const { operations } = useOperations();
  const activeOps = operations.filter((op) => op.status === "active");
  const hasOps = operations.length > 0;

  if (!hasOps) return null;

  return (
    <button
      class={`btn-ops-toggle${activeOps.length > 0 ? " active" : ""}`}
      onClick={onClick}
      title="Operations"
      aria-label={activeOps.length > 0 ? `${activeOps.length} operations in progress` : "View operations history"}
    >
      {activeOps.length > 0 && <span class="ops-toggle-spinner" />}
      <span>{activeOps.length > 0 ? `${activeOps.length} active` : `${operations.length} ops`}</span>
    </button>
  );
}
