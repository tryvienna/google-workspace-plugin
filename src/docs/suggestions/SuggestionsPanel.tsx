/**
 * SuggestionsPanel — Full suggestion list view.
 *
 * Follows Vienna's drawer content pattern: section header, compact list,
 * bulk actions as subtle text buttons in the toolbar.
 * Keyboard: arrow keys navigate, Enter/Space expand, A accept, R reject.
 */

import { useState, useCallback, useRef } from 'react';
import { DrawerBody } from '@tryvienna/ui';
import { Sparkles, Check, X } from 'lucide-react';
import { SuggestionCard } from './SuggestionCard';
import type { SuggestionCardData } from './SuggestionCard';

interface SuggestionsPanelProps {
  suggestions: SuggestionCardData[];
  processingIds: Set<string>;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onClear: () => void;
  isProcessingAll: boolean;
  defaultExpanded?: boolean;
}

export function SuggestionsPanel({
  suggestions,
  processingIds,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  onClear,
  isProcessingAll,
  defaultExpanded = false,
}: SuggestionsPanelProps) {
  const count = suggestions.length;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => (defaultExpanded ? new Set(suggestions.map((s) => s.id)) : new Set()),
  );
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

      const target = e.target as HTMLElement;
      const currentId = suggestions.find((s) => cardRefs.current.get(s.id) === target)?.id;
      if (!currentId) return;

      e.preventDefault();
      const idx = suggestions.findIndex((s) => s.id === currentId);
      const nextIdx =
        e.key === 'ArrowDown'
          ? Math.min(idx + 1, suggestions.length - 1)
          : Math.max(idx - 1, 0);

      cardRefs.current.get(suggestions[nextIdx].id)?.focus();
    },
    [suggestions],
  );

  const setCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  if (count === 0) {
    return (
      <DrawerBody>
        <div className="flex flex-col items-center gap-2 py-12">
          <Sparkles size={20} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground">No suggestions</span>
          <span className="text-[11px] text-muted-foreground">
            Ask Claude to review this document to generate suggestions.
          </span>
        </div>
      </DrawerBody>
    );
  }

  return (
    <>
      {/* Bulk actions */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <button
          type="button"
          onClick={onAcceptAll}
          disabled={isProcessingAll}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-green-600 transition-colors disabled:opacity-40"
        >
          <Check size={12} />
          Accept all
        </button>
        <button
          type="button"
          onClick={onRejectAll}
          disabled={isProcessingAll}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-40"
        >
          <X size={12} />
          Reject all
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={isProcessingAll}
          className="ml-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          Dismiss
        </button>
      </div>

      {/* Suggestion list */}
      <DrawerBody>
        <div className="space-y-0.5" role="list" onKeyDown={handleListKeyDown}>
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              ref={(el) => setCardRef(suggestion.id, el)}
              suggestion={suggestion}
              isProcessing={processingIds.has(suggestion.id) || isProcessingAll}
              expanded={expandedIds.has(suggestion.id)}
              onToggle={handleToggle}
              onAccept={onAccept}
              onReject={onReject}
            />
          ))}
        </div>
      </DrawerBody>
    </>
  );
}
