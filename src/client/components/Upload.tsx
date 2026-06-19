import { useState, useRef, useCallback, useEffect } from "preact/hooks";
import { useToast } from "./Toast";

interface ConfirmDialogProps {
  open: boolean;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ open, message, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && confirmRef.current) {
      confirmRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Capture phase: block ALL other keyboard handlers while dialog is open
    const handler = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape" || e.key === "n" || e.key === "N") { e.preventDefault(); onCancel(); }
      else if (e.key === "y" || e.key === "Y" || e.key === "Enter") { e.preventDefault(); onConfirm(); }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div class="confirm-backdrop" onClick={onCancel}>
      <div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-msg" onClick={(e) => e.stopPropagation()}>
        <p id="confirm-msg" class="confirm-message">{message}</p>
        <div class="confirm-actions">
          <button ref={confirmRef} class="confirm-btn confirm-btn-primary" onClick={onConfirm}>
            {confirmLabel} <span class="confirm-shortcut">y</span>
          </button>
          <button class="confirm-btn confirm-btn-secondary" onClick={onCancel}>
            {cancelLabel} <span class="confirm-shortcut">n</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface UploadProps {
  currentPath: string;
  onUploadComplete: () => void;
}

export function Upload({ currentPath, onUploadComplete }: UploadProps) {
  const [progress, setProgress] = useState<{ active: boolean; pct: number; label: string }>({
    active: false, pct: 0, label: "Uploading...",
  });
  const [dragActive, setDragActive] = useState(false);
  const [overwriteDialog, setOverwriteDialog] = useState<{ names: string[]; pendingToken: string } | null>(null);
  const dragCount = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const uploadFiles = useCallback((files: FileList | null, overwrite: boolean, pendingToken: string | null) => {
    const fd = new FormData();
    fd.append("path", currentPath);
    if (overwrite) fd.append("overwrite", "true");
    if (pendingToken) {
      fd.append("pendingToken", pendingToken);
    } else if (files) {
      for (let i = 0; i < files.length; i++) {
        fd.append("files", files[i]);
      }
    }

    const fileCount = files ? files.length : 0;
    const label = fileCount > 0
      ? `Uploading ${fileCount} file${fileCount > 1 ? "s" : ""}...`
      : "Uploading...";
    setProgress({ active: true, pct: 0, label });

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/__api/upload");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress({ active: true, pct: (e.loaded / e.total) * 100, label });
      }
    };

    xhr.onload = () => {
      setProgress({ active: false, pct: 0, label: "" });
      if (xhr.status === 409) {
        const data = JSON.parse(xhr.responseText);
        setOverwriteDialog({ names: data.conflicts, pendingToken: data.pendingToken });
        return;
      }
      if (xhr.status >= 400) {
        try {
          const err = JSON.parse(xhr.responseText);
          showToast(`Error: ${err.error || "Upload failed"}`);
        } catch {
          showToast("Error: Upload failed");
        }
        return;
      }
      const data = JSON.parse(xhr.responseText);
      if (data && data.ok) {
        showToast(`${data.files.length} file${data.files.length > 1 ? "s" : ""} uploaded`);
        onUploadComplete();
      }
    };

    xhr.onerror = () => {
      setProgress({ active: false, pct: 0, label: "" });
      showToast("Error: Upload failed (network error)");
    };

    xhr.send(fd);
  }, [currentPath, showToast, onUploadComplete]);

  const handleOverwriteConfirm = useCallback(() => {
    if (!overwriteDialog) return;
    setOverwriteDialog(null);
    uploadFiles(null, true, overwriteDialog.pendingToken);
  }, [overwriteDialog, uploadFiles]);

  const handleOverwriteCancel = useCallback(() => {
    setOverwriteDialog(null);
  }, []);

  const triggerUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      uploadFiles(input.files, false, null);
    }
    input.value = "";
  }, [uploadFiles]);

  // Drag and drop handlers - attached to document
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCount.current++;
      if (dragCount.current === 1) setDragActive(true);
    };

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCount.current--;
      if (dragCount.current <= 0) {
        dragCount.current = 0;
        setDragActive(false);
      }
    };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCount.current = 0;
      setDragActive(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files, false, null);
      }
    };

    document.addEventListener("dragenter", onDragEnter);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);

    return () => {
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [uploadFiles]);

  return (
    <>
      {/* Upload button */}
      <button class="btn-upload" onClick={triggerUpload} title="Upload files">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Upload
      </button>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        style="display:none"
        aria-hidden="true"
        onChange={handleFileChange}
      />

      {/* Upload progress */}
      <div class={`upload-progress${progress.active ? " active" : ""}`} role="status" aria-live="polite">
        <div class="upload-progress-label">
          <span>{progress.label}</span>
          <span>{Math.round(progress.pct)}%</span>
        </div>
        <div class="upload-progress-bar">
          <div class="upload-progress-fill" style={`width:${progress.pct}%`}></div>
        </div>
      </div>

      {/* Drop overlay */}
      <div class={`drop-overlay${dragActive ? " active" : ""}`} aria-hidden="true">
        <div class="drop-overlay-box">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <div class="drop-overlay-text">Drop files to upload</div>
          <div class="drop-overlay-sub">Files will be uploaded to the current directory</div>
        </div>
      </div>

      {/* Overwrite confirmation dialog */}
      <ConfirmDialog
        open={overwriteDialog !== null}
        message={overwriteDialog ? `${overwriteDialog.names.length > 3 ? `${overwriteDialog.names.length} files` : overwriteDialog.names.join(", ")} already exist${overwriteDialog.names.length === 1 ? "s" : ""}. Overwrite?` : ""}
        confirmLabel="Overwrite"
        cancelLabel="Cancel"
        onConfirm={handleOverwriteConfirm}
        onCancel={handleOverwriteCancel}
      />
    </>
  );
}
