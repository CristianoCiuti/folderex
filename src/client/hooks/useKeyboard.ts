import { useEffect, useRef, useCallback } from "preact/hooks";

interface UseKeyboardOptions {
  getRowCount: () => number;
  focusIdx: number;
  setFocusIdx: (idx: number | ((prev: number) => number)) => void;
  onOpen: (idx: number) => void;
  onDownload: (idx: number) => void;
  onShare: (idx: number) => void;
  onDelete: (idx: number) => void;
  onRename: (idx: number) => void;
  onClone: (idx: number) => void;
  onUpload: () => void;
  onFocusClipboard: () => void;
  onToggleClipboard: () => void;
  onCycleTheme: () => void;
  onNavigateUp: () => void;
  onFilter: () => void;
  onGlobalSearch: () => void;
  deleteConfirmIdx: number;
  renameIdx: number;
  onDeleteConfirmYes: () => void;
  onDeleteConfirmNo: () => void;
  globalSearchOpen: boolean;
}

export function useKeyboard(opts: UseKeyboardOptions) {
  const {
    getRowCount, focusIdx, setFocusIdx,
    onOpen, onDownload, onShare, onDelete, onRename, onClone,
    onUpload, onFocusClipboard, onToggleClipboard,
    onCycleTheme, onNavigateUp, onFilter, onGlobalSearch,
    deleteConfirmIdx, renameIdx, onDeleteConfirmYes, onDeleteConfirmNo,
    globalSearchOpen,
  } = opts;

  const kbActive = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintEl = useRef<HTMLDivElement | null>(null);

  const showHint = useCallback(() => {
    if (hintEl.current) hintEl.current.classList.add("visible");
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => {
      if (hintEl.current) hintEl.current.classList.remove("visible");
    }, 10000);
  }, []);

  const showHintPanel = useCallback(() => {
    showHint();
  }, [showHint]);

  const hideHint = useCallback(() => {
    if (hintEl.current) hintEl.current.classList.remove("visible");
  }, []);

  const enterKbMode = useCallback(() => {
    kbActive.current = true;
    showHint();
    if (document.activeElement && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur();
    }
  }, [showHint]);

  const exitKbMode = useCallback(() => {
    kbActive.current = false;
    setFocusIdx(-1);
    hideHint();
  }, [setFocusIdx, hideHint]);

  useEffect(() => {
    const handleMouseDown = () => {
      // Hide hint panel on mouse interaction, but don't reset focus
      // (clicking a row will set focus via onFocusRow)
      kbActive.current = false;
      hideHint();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+/ or Cmd+/: global search
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        onGlobalSearch();
        return;
      }

      // If global search is open, let it handle its own keys
      if (globalSearchOpen) return;

      const tag = (document.activeElement?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Block all shortcuts during rename (input handles its own keys)
      if (renameIdx >= 0) return;

      // Handle delete confirmation y/n
      if (deleteConfirmIdx >= 0) {
        if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          onDeleteConfirmYes();
          return;
        }
        if (e.key === "n" || e.key === "N" || e.key === "Escape") {
          e.preventDefault();
          onDeleteConfirmNo();
          return;
        }
        // Block all other keys during confirmation
        e.preventDefault();
        return;
      }

      const rowCount = getRowCount();
      let handled = false;

      switch (e.key) {
        case "j":
        case "ArrowDown":
          if (rowCount > 0) {
            setFocusIdx((prev) => Math.min(prev + 1, rowCount - 1));
            enterKbMode();
            handled = true;
          }
          break;

        case "k":
        case "ArrowUp":
          if (rowCount > 0) {
            setFocusIdx((prev) => Math.max(prev - 1, 0));
            enterKbMode();
            handled = true;
          }
          break;

        case "Enter":
          if (focusIdx >= 0) { onOpen(focusIdx); handled = true; }
          break;

        case "d":
          if (focusIdx >= 0) { onDownload(focusIdx); handled = true; }
          break;

        case "c":
          if (focusIdx >= 0) { onShare(focusIdx); handled = true; }
          break;

        case "x":
        case "Delete":
          if (focusIdx >= 0) { onDelete(focusIdx); handled = true; }
          break;

        case "r":
          if (focusIdx >= 0) { onRename(focusIdx); handled = true; }
          break;

        case "p":
          if (focusIdx >= 0) { onClone(focusIdx); handled = true; }
          break;

        case "u":
          onUpload();
          handled = true;
          break;

        case "i":
          onFocusClipboard();
          handled = true;
          break;

        case "s":
          onToggleClipboard();
          handled = true;
          break;

        case "Backspace":
          onNavigateUp();
          handled = true;
          break;

        case "t":
          onCycleTheme();
          handled = true;
          break;

        case "?":
          showHint();
          handled = true;
          break;

        case "/":
          onFilter();
          handled = true;
          break;

        case "Escape":
          exitKbMode();
          handled = true;
          break;
      }

      if (handled) e.preventDefault();
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [focusIdx, getRowCount, setFocusIdx, enterKbMode, exitKbMode, onOpen, onDownload, onShare, onDelete, onRename, onClone, onUpload, onFocusClipboard, onToggleClipboard, onCycleTheme, onNavigateUp, onFilter, onGlobalSearch, showHint, deleteConfirmIdx, renameIdx, onDeleteConfirmYes, onDeleteConfirmNo, globalSearchOpen]);

  return { hintRef: hintEl, showHintPanel };
}
