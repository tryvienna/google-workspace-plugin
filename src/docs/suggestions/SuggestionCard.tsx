/**
 * SuggestionCard — Individual suggestion row with inline diff.
 *
 * Follows Vienna's list-item pattern (Linear sub-issues, sidebar menu items):
 * clean rows with hover:bg-muted/50, compact typography, subtle actions.
 *
 * Collapsed: description + category badge + action icons on hover.
 * Expanded: adds inline diff and rationale below.
 * Keyboard: Enter/Space toggles, A accepts, R rejects, arrow keys navigate (via parent).
 */

import { useCallback, forwardRef } from 'react';
import { Spinner } from '@tryvienna/ui';
import { Check, X } from 'lucide-react';

export interface SuggestionCardPart {
  id: string;
  changeType: string;
  original: string | null;
  proposed: string | null;
}

export interface SuggestionCardData {
  id: string;
  description: string;
  rationale?: string;
  category?: string;
  parts: SuggestionCardPart[];
}

interface SuggestionCardProps {
  suggestion: SuggestionCardData;
  isProcessing: boolean;
  expanded: boolean;
  onToggle: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onMouseEnter?: (suggestion: SuggestionCardData) => void;
  onMouseLeave?: () => void;
}

const categoryStyle: Record<string, string> = {
  content: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  clarity: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  structure: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  formatting: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  updates: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
};

const fallbackCategory = 'bg-muted text-muted-foreground border-border';

export const SuggestionCard = forwardRef<HTMLDivElement, SuggestionCardProps>(
  function SuggestionCard(
    {
      suggestion,
      isProcessing,
      expanded,
      onToggle,
      onAccept,
      onReject,
      onMouseEnter,
      onMouseLeave,
    },
    ref,
  ) {
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (isProcessing) return;
        switch (e.key) {
          case 'Enter':
          case ' ':
            e.preventDefault();
            onToggle(suggestion.id);
            break;
          case 'a':
          case 'A':
            e.preventDefault();
            onAccept(suggestion.id);
            break;
          case 'r':
          case 'R':
          case 'Delete':
          case 'Backspace':
            e.preventDefault();
            onReject(suggestion.id);
            break;
        }
      },
      [suggestion.id, isProcessing, onToggle, onAccept, onReject],
    );

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        className={[
          'group relative rounded px-3 py-2.5 outline-none cursor-pointer transition-colors',
          'hover:bg-muted/50 focus-visible:bg-muted/50',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
          expanded ? 'bg-muted/30' : '',
        ].join(' ')}
        onMouseEnter={() => onMouseEnter?.(suggestion)}
        onMouseLeave={() => onMouseLeave?.()}
        onClick={() => onToggle(suggestion.id)}
        onKeyDown={handleKeyDown}
      >
        {/* Primary row */}
        <div className="flex items-center gap-2">
          <span className="text-xs flex-1 min-w-0 truncate text-foreground">
            {suggestion.description}
          </span>

          {suggestion.category && (
            <span
              className={`inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-medium shrink-0 ${
                categoryStyle[suggestion.category] ?? fallbackCategory
              }`}
            >
              {suggestion.category}
            </span>
          )}

          {/* Actions — visible on hover/focus */}
          <div
            className={[
              'flex items-center gap-px shrink-0 transition-opacity',
              isProcessing
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReject(suggestion.id); }}
              disabled={isProcessing}
              className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-40"
              tabIndex={-1}
              aria-label="Reject suggestion"
            >
              <X size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAccept(suggestion.id); }}
              disabled={isProcessing}
              className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-green-600 hover:bg-green-500/10 transition-colors disabled:opacity-40"
              tabIndex={-1}
              aria-label="Accept suggestion"
            >
              {isProcessing ? <Spinner className="size-3" /> : <Check size={14} />}
            </button>
          </div>
        </div>

        {/* Expanded: diff + rationale */}
        {expanded && (
          <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
            {suggestion.parts.map((part) => (
              <div key={part.id} className="rounded-md border border-border overflow-hidden text-xs font-mono leading-relaxed">
                {part.original && (
                  <div className="px-3 py-1.5 bg-red-500/[0.04] border-b border-border last:border-b-0">
                    <span className="text-red-700 dark:text-red-400 line-through decoration-red-400/40">
                      {part.original}
                    </span>
                  </div>
                )}
                {part.proposed && (
                  <div className="px-3 py-1.5 bg-green-500/[0.04]">
                    <span className="text-green-700 dark:text-green-400">{part.proposed}</span>
                  </div>
                )}
              </div>
            ))}
            {suggestion.rationale && (
              <p className="text-[11px] text-muted-foreground leading-relaxed pl-0.5">
                {suggestion.rationale}
              </p>
            )}
          </div>
        )}
      </div>
    );
  },
);
