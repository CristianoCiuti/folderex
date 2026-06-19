import { useRef, useCallback, useEffect } from "preact/hooks";

interface ClipboardProps {
  connected: boolean;
  sendClipboard: (text: string) => void;
  clipboardText: string;
  onClipboardChange: (text: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function Clipboard({ connected, sendClipboard, clipboardText, onClipboardChange, collapsed, onToggle }: ClipboardProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreRef = useRef(false);

  // Sync external clipboard text to textarea
  useEffect(() => {
    if (textareaRef.current && !ignoreRef.current) {
      const ta = textareaRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      ta.value = clipboardText;
      ta.selectionStart = start;
      ta.selectionEnd = end;
    }
  }, [clipboardText]);

  const handleInput = useCallback(() => {
    if (ignoreRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const text = textareaRef.current?.value || "";
      onClipboardChange(text);
      sendClipboard(text);
    }, 150);
  }, [sendClipboard, onClipboardChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      textareaRef.current?.blur();
    }
  }, []);

  return (
    <div class="clipboard-section">
      <button
        class="clipboard-header"
        aria-expanded={!collapsed}
        aria-controls="clipBody"
        onClick={onToggle}
      >
        <span
          class={`clipboard-dot${connected ? " connected" : ""}`}
          role="status"
          aria-label={`Connection status: ${connected ? "connected" : "disconnected"}`}
        />
        <span class="clipboard-title">Shared Clipboard</span>
        <span class="clipboard-hint">&mdash; syncs text between all connected clients</span>
        <span class="clipboard-toggle" aria-hidden="true">{collapsed ? "Show" : "Hide"}</span>
      </button>
      <div class={`clipboard-body${collapsed ? " collapsed" : ""}`} id="clipBody" role="region" aria-label="Shared clipboard">
        <textarea
          ref={textareaRef}
          placeholder="Type or paste here. Content syncs in real time with all connected clients."
          aria-label="Shared clipboard text"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          value={clipboardText}
        />
      </div>
    </div>
  );
}
