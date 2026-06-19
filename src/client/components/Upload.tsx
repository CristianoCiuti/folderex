import { useState, useRef, useCallback, useEffect } from "preact/hooks";
import { useToast } from "./Toast";
import { useOperations } from "../hooks/useOperations";

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
  const [dragActive, setDragActive] = useState(false);
  const [overwriteDialog, setOverwriteDialog] = useState<{ names: string[]; pendingToken: string } | null>(null);
  const dragCount = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const { addClientOperation, updateClientOperation, completeClientOperation } = useOperations();

  const uploadFiles = useCallback((files: FileList | null, overwrite: boolean, pendingToken: string | null, overrideLabel?: string) => {
    const fileCount = files ? files.length : 0;
    let label: string;
    if (overrideLabel) {
      label = overrideLabel;
    } else if (files && fileCount === 1) {
      label = `Upload ${files[0].name}`;
    } else if (files && fileCount > 1) {
      label = `Upload ${files[0].name} +${fileCount - 1}`;
    } else {
      label = "Upload";
    }

    const fd = new FormData();
    fd.append("path", currentPath);
    fd.append("label", label);
    if (overwrite) fd.append("overwrite", "true");
    if (pendingToken) {
      fd.append("pendingToken", pendingToken);
    } else if (files) {
      for (let i = 0; i < files.length; i++) {
        fd.append("files", files[i]);
      }
    }

    const xhr = new XMLHttpRequest();

    const opId = addClientOperation({
      type: "upload",
      label,
      status: "active",
      progress: 0,
      abort: () => {
        xhr.abort();
      },
    });

    xhr.open("POST", "/__api/upload");
    xhr.setRequestHeader("X-Op-Id", opId);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        updateClientOperation(opId, { progress: (e.loaded / e.total) * 100 });
      }
    };

    xhr.onload = () => {
      if (xhr.status === 409) {
        const data = JSON.parse(xhr.responseText);
        // Server already registered this as "File conflict" with same opId
        setOverwriteDialog({ names: data.conflicts, pendingToken: data.pendingToken });
        return;
      }
      if (xhr.status >= 400) {
        try {
          const err = JSON.parse(xhr.responseText);
          completeClientOperation(opId, err.error || "Upload failed");
        } catch {
          completeClientOperation(opId, "Upload failed");
        }
        return;
      }
      const data = JSON.parse(xhr.responseText);
      if (data && data.ok) {
        // Server op with same ID will arrive via WebSocket and replace this one
        showToast(`${data.files.length} file${data.files.length > 1 ? "s" : ""} uploaded`);
        onUploadComplete();
      }
    };

    xhr.onerror = () => {
      completeClientOperation(opId, "Network error");
    };

    xhr.onabort = () => {
      // Already handled by the abort callback
    };

    xhr.send(fd);
  }, [currentPath, showToast, onUploadComplete, addClientOperation, updateClientOperation, completeClientOperation]);

  const handleOverwriteConfirm = useCallback(() => {
    if (!overwriteDialog) return;
    const names = overwriteDialog.names;
    const label = names.length === 1 ? `Upload ${names[0]}` : `Upload ${names[0]} +${names.length - 1}`;
    setOverwriteDialog(null);
    uploadFiles(null, true, overwriteDialog.pendingToken, label);
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

  // Drag and drop handlers
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
