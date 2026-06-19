import { useState, useCallback, useRef, useEffect, useMemo } from "preact/hooks";
import { ToastProvider, useToast } from "./Toast";
import { BreadcrumbNav } from "./Breadcrumb";
import { FileTable } from "./FileTable";
import { FilterBar } from "./FilterBar";
import { GlobalSearch } from "./GlobalSearch";
import { Upload } from "./Upload";
import { Clipboard } from "./Clipboard";
import { OperationsPanel } from "./OperationsPanel";
import { useTheme } from "../hooks/useTheme";
import { useWebSocket } from "../hooks/useWebSocket";
import { useKeyboard } from "../hooks/useKeyboard";
import { OperationsContext, useOperationsProvider, useOperations } from "../hooks/useOperations";
import type { FileEntry, Breadcrumb, ListResponse } from "../types";

export function App() {
  const opsProvider = useOperationsProvider();
  return (
    <OperationsContext.Provider value={opsProvider}>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </OperationsContext.Provider>
  );
}

function AppInner() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState("/");
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ name: "~", path: "/" }]);
  const [focusIdx, setFocusIdx] = useState(-1);
  const [clipboardText, setClipboardText] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteConfirmIdx, setDeleteConfirmIdx] = useState(-1);
  const [renameIdx, setRenameIdx] = useState(-1);
  const [filterQuery, setFilterQuery] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const clipboardRef = useRef<{ focus: () => void } | null>(null);

  const { pref, cycleTheme } = useTheme();
  const { showToast } = useToast();
  const { operations, addClientOperation, updateClientOperation, completeClientOperation, handleServerOperation, handleOperationsSync } = useOperations();

  // Fetch directory listing with loading state
  const fetchList = useCallback(async (path: string, resetFocus = true) => {
    setLoading(true);
    try {
      const res = await fetch(`/__api/list?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ListResponse = await res.json();
      setEntries(data.entries);
      setCurrentPath(data.path);
      setBreadcrumbs(data.breadcrumbs);
      if (resetFocus) setFocusIdx(-1);
      setDeleteConfirmIdx(-1);
      setRenameIdx(-1);
    } catch (err) {
      console.error("Failed to fetch file list:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load - derive path from URL
  useEffect(() => {
    const path = decodeURIComponent(window.location.pathname);
    fetchList(path);
  }, [fetchList]);

  // Navigate to a directory
  const navigate = useCallback((path: string) => {
    window.history.pushState(null, "", path);
    setFilterQuery("");
    fetchList(decodeURIComponent(path));
  }, [fetchList]);

  // Handle browser back/forward
  useEffect(() => {
    const handler = () => {
      const path = decodeURIComponent(window.location.pathname);
      fetchList(path);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [fetchList]);

  // WebSocket
  const onClipboardReceived = useCallback((text: string) => {
    setClipboardText(text);
  }, []);

  // Filtered entries for local filter
  const filteredEntries = useMemo(() => {
    if (!filterQuery.trim()) return entries;
    const q = filterQuery.toLowerCase();
    return entries.filter((e) => e.name.toLowerCase().includes(q));
  }, [entries, filterQuery]);

  const onFsChange = useCallback(() => {
    const path = decodeURIComponent(window.location.pathname);
    fetchList(path, false);
  }, [fetchList]);

  const { connected, sendClipboard } = useWebSocket({
    onClipboard: onClipboardReceived,
    onFsChange,
    onOperation: handleServerOperation,
    onOperationsSync: handleOperationsSync,
  });

  // Actions
  const handleShare = useCallback((resourcePath: string) => {
    const url = location.origin + resourcePath;
    navigator.clipboard.writeText(url).then(() => {
      showToast("Link copied");
    }).catch(() => {
      const tmp = document.createElement("input");
      tmp.value = url;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand("copy");
      document.body.removeChild(tmp);
      showToast("Link copied");
    });
  }, [showToast]);

  const handleDelete = useCallback((resourcePath: string, name: string) => {
    // Capture the index before deletion for focus restore on undo
    const deletedIdx = entries.findIndex((e) => {
      const entryPath = currentPath + encodeURIComponent(e.name) + (e.isDirectory ? "/" : "");
      return entryPath === resourcePath;
    });

    fetch("/__api/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: resourcePath }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => { throw new Error(d.error || "Delete failed"); });
        return res.json();
      })
      .then((data) => {
        // Optimistically remove from list
        setEntries((prev) => prev.filter((e) => {
          const entryPath = currentPath + encodeURIComponent(e.name) + (e.isDirectory ? "/" : "");
          return entryPath !== resourcePath;
        }));

        showToast(`Deleted ${name}`, {
          duration: 8000,
          danger: true,
          action: {
            label: "Undo",
            shortcutKey: "z",
            onClick: () => {
              fetch("/__api/restore", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ trashToken: data.trashToken }),
              })
                .then((res) => {
                  if (!res.ok) return res.json().then((d) => { throw new Error(d.error || "Restore failed"); });
                  return res.json();
                })
                .then(() => {
                  const path = decodeURIComponent(window.location.pathname);
                  fetchList(path, false).then(() => {
                    if (deletedIdx >= 0) setFocusIdx(deletedIdx);
                  });
                })
                .catch((err) => {
                  showToast(`Error restoring: ${err.message}`);
                });
            },
          },
        });
      })
      .catch((err) => {
        showToast(`Error: ${err.message}`);
      });
  }, [currentPath, entries, showToast, fetchList]);

  const handleUploadComplete = useCallback(() => {
    const path = decodeURIComponent(window.location.pathname);
    fetchList(path);
  }, [fetchList]);

  // Clipboard
  const handleClipboardChange = useCallback((text: string) => {
    setClipboardText(text);
  }, []);

  // Keyboard navigation
  const getRowCount = useCallback(() => filteredEntries.length, [filteredEntries]);

  const onOpen = useCallback((idx: number) => {
    const entry = filteredEntries[idx];
    if (!entry) return;
    if (entry.isDirectory) {
      navigate(`${currentPath}${encodeURIComponent(entry.name)}/`);
    } else {
      window.location.href = `${currentPath}${encodeURIComponent(entry.name)}`;
    }
  }, [filteredEntries, currentPath, navigate]);

  const onDownload = useCallback((idx: number) => {
    const entry = filteredEntries[idx];
    if (!entry) return;
    const downloadPath = `/__download${currentPath}${encodeURIComponent(entry.name)}${entry.isDirectory ? "/" : ""}`;
    window.location.href = downloadPath;
  }, [filteredEntries, currentPath]);

  const onShareKb = useCallback((idx: number) => {
    const entry = filteredEntries[idx];
    if (!entry) return;
    const resourcePath = `${currentPath}${encodeURIComponent(entry.name)}${entry.isDirectory ? "/" : ""}`;
    handleShare(resourcePath);
  }, [filteredEntries, currentPath, handleShare]);

  const onDeleteKb = useCallback((idx: number) => {
    // Show inline confirmation instead of immediate delete
    setDeleteConfirmIdx(idx);
  }, []);

  const handleDeleteConfirm = useCallback((idx: number) => {
    setDeleteConfirmIdx(idx);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmIdx(-1);
  }, []);

  const handleConfirmedDelete = useCallback((resourcePath: string, name: string) => {
    const deletedIdx = deleteConfirmIdx;
    setDeleteConfirmIdx(-1);
    handleDelete(resourcePath, name);
    // Adjust focus: move to previous item, or next, or clear
    setFocusIdx((prev) => {
      const newLen = entries.length - 1;
      if (newLen <= 0) return -1;
      if (deletedIdx >= newLen) return newLen - 1;
      return deletedIdx > 0 ? deletedIdx - 1 : 0;
    });
  }, [handleDelete, deleteConfirmIdx, entries.length]);

  // Rename
  const handleRenameStart = useCallback((idx: number) => {
    setDeleteConfirmIdx(-1);
    setRenameIdx(idx);
  }, []);

  const handleRenameCancel = useCallback(() => {
    setRenameIdx(-1);
  }, []);

  const handleRenameSubmit = useCallback((idx: number, newName: string) => {
    const entry = entries[idx];
    if (!entry) { setRenameIdx(-1); return; }
    const resourcePath = `${currentPath}${encodeURIComponent(entry.name)}${entry.isDirectory ? "/" : ""}`;

    fetch("/__api/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: resourcePath, newName }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => { throw new Error(d.error || "Rename failed"); });
        return res.json();
      })
      .then(() => {
        setRenameIdx(-1);
        const path = decodeURIComponent(window.location.pathname);
        fetchList(path, false);
        setFocusIdx(idx);
        showToast(`Renamed to ${newName}`);
      })
      .catch((err) => {
        showToast(`Error: ${err.message}`);
        setRenameIdx(-1);
      });
  }, [entries, currentPath, fetchList, showToast]);

  const onRenameKb = useCallback((idx: number) => {
    setDeleteConfirmIdx(-1);
    setRenameIdx(idx);
  }, []);

  // Clone
  const handleClone = useCallback((resourcePath: string) => {
    fetch("/__api/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: resourcePath }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => { throw new Error(d.error || "Clone failed"); });
        return res.json();
      })
      .then((data) => {
        if (!data.async) {
          // Instant clone - refresh immediately
          const path = decodeURIComponent(window.location.pathname);
          fetchList(path, false);
        }
        showToast(`Created ${data.newName}`);
      })
      .catch((err) => {
        showToast(`Error: ${err.message}`);
      });
  }, [fetchList, showToast]);

  const onCloneKb = useCallback((idx: number) => {
    const entry = filteredEntries[idx];
    if (!entry) return;
    const resourcePath = `${currentPath}${encodeURIComponent(entry.name)}${entry.isDirectory ? "/" : ""}`;
    handleClone(resourcePath);
  }, [filteredEntries, currentPath, handleClone]);

  const uploadRef = useRef<{ triggerUpload: () => void } | null>(null);

  const onUpload = useCallback(() => {
    // Trigger upload via the hidden file input
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    input?.click();
  }, []);

  const [clipboardCollapsed, setClipboardCollapsed] = useState(false);

  const onFocusClipboard = useCallback(() => {
    setClipboardCollapsed(false);
    setTimeout(() => {
      const ta = document.querySelector(".clipboard-body textarea") as HTMLTextAreaElement;
      ta?.focus();
    }, 0);
  }, []);

  const onToggleClipboard = useCallback(() => {
    setClipboardCollapsed((prev) => !prev);
  }, []);

  const onNavigateUp = useCallback(() => {
    if (breadcrumbs.length > 1) {
      const parent = breadcrumbs[breadcrumbs.length - 2];
      navigate(parent.path);
    }
  }, [breadcrumbs, navigate]);

  const onFilter = useCallback(() => {
    setFilterVisible(true);
    // Focus after render
    setTimeout(() => filterInputRef.current?.focus(), 0);
  }, []);

  const onGlobalSearch = useCallback(() => {
    setGlobalSearchOpen(true);
  }, []);

  const { hintRef, showHintPanel } = useKeyboard({
    getRowCount,
    focusIdx,
    setFocusIdx,
    onOpen,
    onDownload,
    onShare: onShareKb,
    onDelete: onDeleteKb,
    onRename: onRenameKb,
    onClone: onCloneKb,
    onUpload,
    onFocusClipboard,
    onToggleClipboard,
    onCycleTheme: cycleTheme,
    onNavigateUp,
    onFilter,
    onGlobalSearch,
    deleteConfirmIdx,
    renameIdx,
    globalSearchOpen,
    onDeleteConfirmYes: () => {
      const entry = filteredEntries[deleteConfirmIdx];
      if (!entry) return;
      const resourcePath = `${currentPath}${encodeURIComponent(entry.name)}${entry.isDirectory ? "/" : ""}`;
      handleConfirmedDelete(resourcePath, entry.name);
    },
    onDeleteConfirmNo: handleDeleteCancel,
  });

  // Theme label
  const themeLabels: Record<string, string> = { dark: "Dark", light: "Light", system: "Auto" };

  return (
    <div class="container">
      <header>
        <div class="logo-wrap">
          <svg class="logo-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M12 11v6"/><path d="M9 14l3-3 3 3"/></svg>
          <span class="logo">folderex</span>
        </div>
        <BreadcrumbNav breadcrumbs={breadcrumbs} onNavigate={navigate} />
        <div class="header-right">
          <Upload currentPath={currentPath} onUploadComplete={handleUploadComplete} />
          <span class="theme-label">{themeLabels[pref] || ""}</span>
          <button class="theme-toggle" onClick={cycleTheme} title="Switch theme" aria-label={`Theme: ${themeLabels[pref] || pref}. Click to switch.`}>
            {pref === "dark" && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
            {pref === "light" && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            )}
            {pref === "system" && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            )}
          </button>
        </div>
      </header>

      <FilterBar
        value={filterQuery}
        onChange={setFilterQuery}
        visible={filterVisible}
        onHide={() => setFilterVisible(false)}
        totalCount={entries.length}
        matchCount={filteredEntries.length}
        inputRef={(el) => { filterInputRef.current = el; }}
      />

      <FileTable
        entries={filteredEntries}
        currentPath={currentPath}
        focusIdx={focusIdx}
        loading={loading}
        deleteConfirmIdx={deleteConfirmIdx}
        renameIdx={renameIdx}
        onNavigate={navigate}
        onShare={handleShare}
        onDelete={handleConfirmedDelete}
        onDeleteConfirm={handleDeleteConfirm}
        onDeleteCancel={handleDeleteCancel}
        onRenameStart={handleRenameStart}
        onRenameSubmit={handleRenameSubmit}
        onRenameCancel={handleRenameCancel}
        onClone={handleClone}
        onFocusRow={setFocusIdx}
        filterQuery={filterQuery}
      />

      <Clipboard
        connected={connected}
        sendClipboard={sendClipboard}
        clipboardText={clipboardText}
        onClipboardChange={handleClipboardChange}
        collapsed={clipboardCollapsed}
        onToggle={onToggleClipboard}
      />

      <footer>
        <span>served by folderex</span>
        <button
          class="btn-kb-shortcuts"
          onClick={showHintPanel}
          title="Keyboard shortcuts (?)"
          aria-label="Show keyboard shortcuts"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M6 12h.01"/><path d="M18 12h.01"/><path d="M8 16h8"/></svg>
          <span>Shortcuts</span>
        </button>
      </footer>

      {/* Keyboard hint panel */}
      <div class="kb-hint" ref={hintRef}>
        <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> or <kbd>j</kbd><kbd>k</kbd> navigate</span>
        <span><kbd>Enter</kbd> open</span>
        <span><kbd>/</kbd> filter</span>
        <span><kbd>Ctrl+/</kbd> search</span>
        <span><kbd>r</kbd> rename</span>
        <span><kbd>p</kbd> duplicate</span>
        <span><kbd>d</kbd> download</span>
        <span><kbd>c</kbd> copy link</span>
        <span><kbd>x</kbd> delete</span>
        <span><kbd>u</kbd> upload</span>
        <span><kbd>i</kbd> clipboard</span>
        <span><kbd>s</kbd> toggle clipboard</span>
        <span><kbd>Esc</kbd> exit</span>
      </div>

      <GlobalSearch
        open={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        onNavigate={navigate}
      />

      <OperationsPanel />
    </div>
  );
}
