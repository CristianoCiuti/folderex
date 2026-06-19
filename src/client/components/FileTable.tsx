import { useRef, useEffect } from "preact/hooks";
import type { FileEntry } from "../types";

interface FileTableProps {
  entries: FileEntry[];
  currentPath: string;
  focusIdx: number;
  loading: boolean;
  deleteConfirmIdx: number;
  renameIdx: number;
  filterQuery: string;
  onNavigate: (path: string) => void;
  onShare: (resourcePath: string) => void;
  onDelete: (resourcePath: string, name: string) => void;
  onDeleteConfirm: (idx: number) => void;
  onDeleteCancel: () => void;
  onRenameStart: (idx: number) => void;
  onRenameSubmit: (idx: number, newName: string) => void;
  onRenameCancel: () => void;
  onClone: (resourcePath: string) => void;
  onFocusRow: (idx: number) => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(isoStr: string): string {
  const date = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getIconType(entry: FileEntry): string {
  if (entry.isDirectory) return "folder";
  const ext = entry.name.split(".").pop()?.toLowerCase() || "";
  const iconMap: Record<string, string> = {
    js: "code", ts: "code", jsx: "code", tsx: "code", py: "code", rb: "code",
    go: "code", rs: "code", java: "code", c: "code", cpp: "code", h: "code",
    cs: "code", php: "code", swift: "code", kt: "code", vue: "code", svelte: "code",
    html: "web", htm: "web", css: "web", scss: "web", less: "web",
    json: "data", xml: "data", yaml: "data", yml: "data", csv: "data", sql: "data", toml: "data",
    md: "doc", txt: "doc", pdf: "doc", doc: "doc", docx: "doc", rtf: "doc",
    png: "image", jpg: "image", jpeg: "image", gif: "image", svg: "image", webp: "image", ico: "image", bmp: "image",
    zip: "archive", tar: "archive", gz: "archive", rar: "archive", "7z": "archive", bz2: "archive",
    env: "config", gitignore: "config", dockerignore: "config", editorconfig: "config",
    mp4: "media", mp3: "media", wav: "media", avi: "media", mkv: "media",
  };
  return iconMap[ext] || "file";
}

function FileIcon({ type }: { type: string }) {
  const icons: Record<string, any> = {
    folder: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-folder"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
    file: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-file"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>,
    code: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-code"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
    image: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-image"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
    doc: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-doc"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    data: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-data"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
    web: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-web"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    archive: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-archive"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
    config: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-config"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    media: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-media"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  };
  return icons[type] || icons.file;
}

function RenameInput({ name, onSubmit, onCancel }: { name: string; onSubmit: (newName: string) => void; onCancel: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // Select filename without extension
      const dotIdx = name.lastIndexOf(".");
      if (dotIdx > 0) {
        inputRef.current.setSelectionRange(0, dotIdx);
      } else {
        inputRef.current.select();
      }
    }
  }, [name]);

  return (
    <input
      ref={inputRef}
      class="rename-input"
      type="text"
      defaultValue={name}
      aria-label={`Rename ${name}`}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const val = (e.target as HTMLInputElement).value.trim();
          if (val && val !== name) {
            onSubmit(val);
          } else {
            onCancel();
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
        e.stopPropagation();
      }}
      onBlur={() => {
        onCancel();
      }}
    />
  );
}

export function FileTable({ entries, currentPath, focusIdx, loading, deleteConfirmIdx, renameIdx, filterQuery, onNavigate, onShare, onDelete, onDeleteConfirm, onDeleteCancel, onRenameStart, onRenameSubmit, onRenameCancel, onClone, onFocusRow }: FileTableProps) {
  // Scroll focused row into view
  useEffect(() => {
    if (focusIdx >= 0) {
      const row = document.getElementById(`file-row-${focusIdx}`);
      if (row) row.scrollIntoView({ block: "nearest" });
    }
  }, [focusIdx]);

  if (entries.length === 0 && !loading) {
    return (
      <table aria-label="File listing" role="grid">
        <thead>
          <tr>
            <th aria-label="Type" scope="col"></th>
            <th scope="col">Name</th>
            <th scope="col" style="text-align:right">Size</th>
            <th scope="col">Modified</th>
            <th aria-label="Actions" scope="col"></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colspan={5} class="empty">
              {filterQuery ? (
                <>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-dim);margin-bottom:8px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <div style="margin-bottom:4px">No matches for "{filterQuery}"</div>
                  <div style="font-size:12px;color:var(--text-dim)">Try a different filter term</div>
                </>
              ) : (
                <>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-dim);margin-bottom:8px"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  <div style="margin-bottom:4px">No files here yet</div>
                  <div style="font-size:12px;color:var(--text-dim)">Drop files here or click Upload to add files</div>
                </>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <div class={`file-table-wrap${loading ? " is-loading" : ""}`}>
      <table
        aria-label="File listing"
        role="grid"
        aria-busy={loading}
        aria-activedescendant={focusIdx >= 0 ? `file-row-${focusIdx}` : undefined}
      >
        <thead>
          <tr>
            <th aria-label="Type" scope="col"></th>
            <th scope="col">Name</th>
            <th scope="col" style="text-align:right">Size</th>
            <th scope="col">Modified</th>
            <th aria-label="Actions" scope="col"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => {
            const iconType = getIconType(entry);
            const href = entry.isDirectory
              ? `${currentPath}${encodeURIComponent(entry.name)}/`
              : `${currentPath}${encodeURIComponent(entry.name)}`;
            const resourcePath = entry.isDirectory
              ? `${currentPath}${encodeURIComponent(entry.name)}/`
              : `${currentPath}${encodeURIComponent(entry.name)}`;
            const downloadPath = `/__download${currentPath}${encodeURIComponent(entry.name)}${entry.isDirectory ? "/" : ""}`;
            const sizeStr = entry.isDirectory ? "-" : formatSize(entry.size);
            const dateStr = formatDate(entry.modified);
            const isConfirming = i === deleteConfirmIdx;
            const isRenaming = i === renameIdx;
            const cls = `entry ${entry.isDirectory ? "dir" : "file"}${i === focusIdx ? " kb-focus" : ""}${isConfirming ? " delete-confirm" : ""}${isRenaming ? " renaming" : ""}`;

            return (
              <tr
                key={entry.name}
                class={cls}
                id={`file-row-${i}`}
                data-path={resourcePath}
                data-name={entry.name}
                tabindex={i === focusIdx ? 0 : -1}
                role="row"
                aria-selected={i === focusIdx}
                onClick={() => onFocusRow(i)}
              >
                <td class="col-icon"><FileIcon type={iconType} /></td>
                <td class="col-name">
                  {isConfirming ? (
                    <span class="delete-prompt">
                      <span class="delete-prompt-text">Delete <strong>{entry.name}</strong>?</span>
                      <button
                        class="delete-prompt-yes"
                        onClick={() => onDelete(resourcePath, entry.name)}
                        aria-label={`Confirm delete ${entry.name}`}
                      >
                        Yes
                      </button>
                      <button
                        class="delete-prompt-no"
                        onClick={onDeleteCancel}
                        aria-label="Cancel delete"
                      >
                        No
                      </button>
                      <span class="delete-prompt-hint">
                        <kbd>y</kbd> / <kbd>n</kbd>
                      </span>
                    </span>
                  ) : isRenaming ? (
                    <RenameInput
                      name={entry.name}
                      onSubmit={(newName) => onRenameSubmit(i, newName)}
                      onCancel={onRenameCancel}
                    />
                  ) : (
                    <a
                      href={href}
                      onClick={(e) => {
                        if (entry.isDirectory) {
                          e.preventDefault();
                          onNavigate(href);
                        }
                      }}
                    >
                      {entry.name}
                    </a>
                  )}
                </td>
                <td class="col-size">{sizeStr}</td>
                <td class="col-date">{dateStr}</td>
                <td class="col-actions">
                  {(isConfirming || isRenaming) ? null : (
                    <>
                      <button
                        class="btn-action btn-rename"
                        title="Rename (r)"
                        aria-label={`Rename ${entry.name}`}
                        onClick={() => onRenameStart(i)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </button>
                      <button
                        class="btn-action btn-share"
                        title="Copy link (c)"
                        aria-label={`Copy link for ${entry.name}`}
                        onClick={() => onShare(resourcePath)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      </button>
                      <button
                        class="btn-action btn-clone"
                        title="Duplicate (p)"
                        aria-label={`Duplicate ${entry.name}`}
                        onClick={() => onClone(resourcePath)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                      <a
                        class="btn-action btn-download"
                        title="Download (d)"
                        aria-label={`Download ${entry.name}`}
                        href={downloadPath}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </a>
                      <button
                        class="btn-action btn-delete"
                        title="Delete (x)"
                        aria-label={`Delete ${entry.name}`}
                        onClick={() => onDeleteConfirm(i)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
