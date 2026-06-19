import { useRef } from "preact/hooks";

interface FilterBarProps {
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onHide: () => void;
  totalCount: number;
  matchCount: number;
  inputRef: (el: HTMLInputElement | null) => void;
}

export function FilterBar({ value, onChange, visible, onHide, totalCount, matchCount, inputRef }: FilterBarProps) {
  const internalRef = useRef<HTMLInputElement | null>(null);

  const setRef = (el: HTMLInputElement | null) => {
    internalRef.current = el;
    inputRef(el);
  };

  // Show when parent says visible OR when there's an active filter value
  if (!visible && !value) return null;

  return (
    <div class="filter-bar">
      <div class="filter-bar-inner">
        <svg class="filter-bar-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={setRef}
          class="filter-bar-input"
          type="text"
          value={value}
          placeholder="Filter files…"
          aria-label="Filter files in current directory"
          onInput={(e) => onChange((e.target as HTMLInputElement).value)}
          onBlur={() => {
            onHide();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onChange("");
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "ArrowDown" || e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
            e.stopPropagation();
          }}
        />
        {value && (
          <span class="filter-bar-count">
            {matchCount} of {totalCount}
          </span>
        )}
        {value && (
          <button
            class="filter-bar-clear"
            onClick={() => {
              onChange("");
              internalRef.current?.focus();
            }}
            aria-label="Clear filter"
            title="Clear filter (Esc)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        {!value && (
          <kbd class="filter-bar-shortcut">/</kbd>
        )}
      </div>
    </div>
  );
}
