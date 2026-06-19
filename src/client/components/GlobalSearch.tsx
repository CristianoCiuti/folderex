import { useState, useRef, useEffect, useCallback } from "preact/hooks";

interface SearchResult {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
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

function getIconType(name: string, isDirectory: boolean): string {
  if (isDirectory) return "folder";
  const ext = name.split(".").pop()?.toLowerCase() || "";
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

function ResultIcon({ type }: { type: string }) {
  const icons: Record<string, any> = {
    folder: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-folder"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
    file: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-file"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>,
    code: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-code"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
    image: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-image"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
    doc: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-doc"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    data: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-data"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
    web: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-web"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    archive: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-archive"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
    config: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-config"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    media: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-media"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  };
  return icons[type] || icons.file;
}

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const parts: any[] = [];
  let qi = 0;
  for (let ti = 0; ti < text.length; ti++) {
    if (qi < queryLower.length && textLower[ti] === queryLower[qi]) {
      parts.push(<mark class="search-highlight">{text[ti]}</mark>);
      qi++;
    } else {
      parts.push(text[ti]);
    }
  }
  return <>{parts}</>;
}

function getParentPath(path: string): string {
  // "/foo/bar/baz.txt" -> "foo/bar/"
  const withoutLeading = path.startsWith("/") ? path.slice(1) : path;
  const lastSlash = withoutLeading.lastIndexOf("/");
  if (lastSlash === -1) return "/";
  return withoutLeading.slice(0, lastSlash + 1);
}

export function GlobalSearch({ open, onClose, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Search with debounce
  const doSearch = useCallback((q: string) => {
    if (abortRef.current) abortRef.current.abort();
    if (!q.trim()) {
      setResults([]);
      setSelectedIdx(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`/__api/search?q=${encodeURIComponent(q.trim())}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted) {
          setResults(data.results || []);
          setSelectedIdx(0);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setLoading(false);
        }
      });
  }, []);

  const handleInput = useCallback((value: string) => {
    setQuery(value);
    setSelectedIdx(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 120);
  }, [doSearch]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const item = listRef.current.children[selectedIdx] as HTMLElement;
      if (item) item.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIdx]);

  const handleAction = useCallback((result: SearchResult) => {
    if (result.isDirectory) {
      onNavigate(result.path);
      onClose();
    } else {
      // Download the file
      window.location.href = `/__download${result.path}`;
      onClose();
    }
  }, [onNavigate, onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const result = results[selectedIdx];
      if (result) handleAction(result);
      return;
    }
  }, [results, selectedIdx, handleAction, onClose]);

  if (!open) return null;

  return (
    <div class="global-search-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="global-search-panel">
        <div class="global-search-input-wrap">
          <svg class="global-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            class="global-search-input"
            type="text"
            value={query}
            placeholder="Search all files…"
            aria-label="Search all files recursively"
            onInput={(e) => handleInput((e.target as HTMLInputElement).value)}
            onKeyDown={handleKeyDown as any}
          />
          {loading && <span class="global-search-spinner" />}
          <kbd class="global-search-esc">Esc</kbd>
        </div>
        {results.length > 0 && (
          <div class="global-search-results" ref={listRef} role="listbox" aria-label="Search results">
            {results.map((result, i) => {
              const iconType = getIconType(result.name, result.isDirectory);
              const parentPath = getParentPath(result.path);
              return (
                <div
                  key={result.path}
                  class={`global-search-result${i === selectedIdx ? " selected" : ""}`}
                  role="option"
                  aria-selected={i === selectedIdx}
                  onClick={() => handleAction(result)}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <span class="global-search-result-icon"><ResultIcon type={iconType} /></span>
                  <span class="global-search-result-name">{highlightMatch(result.name, query)}</span>
                  <span class="global-search-result-path">{parentPath}</span>
                  {!result.isDirectory && (
                    <span class="global-search-result-size">{formatSize(result.size)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {query && !loading && results.length === 0 && (
          <div class="global-search-empty">
            <span>No files matching "{query}"</span>
          </div>
        )}
        {!query && (
          <div class="global-search-hint">
            <span>Type to search all files and folders</span>
          </div>
        )}
      </div>
    </div>
  );
}
