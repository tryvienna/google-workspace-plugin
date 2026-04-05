/**
 * InlineSuggestionPopover — Floating action card that appears when hovering
 * the inline suggestion marks (strikethrough/insertion) in the document.
 * Shows description + accept/reject since the diff is visible inline.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button, Spinner, Badge } from '@tryvienna/ui';
import { Check, X } from 'lucide-react';
import type { SuggestionCardData } from './SuggestionCard';

interface InlineSuggestionPopoverProps {
  suggestions: SuggestionCardData[];
  containerRef: React.RefObject<HTMLElement | null>;
  processingIds: Set<string>;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

const SUGGESTION_SELECTOR = '.suggestion-deletion, .suggestion-insertion';

export function InlineSuggestionPopover({
  suggestions,
  containerRef,
  processingIds,
  onAccept,
  onReject,
}: InlineSuggestionPopoverProps) {
  const [activeSuggestion, setActiveSuggestion] = useState<SuggestionCardData | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showPopover = useCallback(
    (el: HTMLElement) => {
      const suggestionId = el.getAttribute('data-suggestion-id');
      if (!suggestionId) return;

      const suggestion = suggestions.find((s) => s.id === suggestionId);
      if (!suggestion) return;

      clearTimeout(hideTimeout.current);

      const rect = el.getBoundingClientRect();
      const gap = 4;

      // Position above the hovered element so the popover doesn't overlap
      // adjacent stacked suggestion blocks below. translateY(-100%) is applied
      // via style so the popover's bottom edge sits just above the element.
      setPosition({
        top: rect.top - gap,
        left: Math.max(gap, rect.left),
      });
      setActiveSuggestion(suggestion);
    },
    [suggestions, containerRef],
  );

  const scheduleHide = useCallback(() => {
    hideTimeout.current = setTimeout(() => {
      setActiveSuggestion(null);
      setPosition(null);
    }, 300);
  }, []);

  const cancelHide = useCallback(() => {
    clearTimeout(hideTimeout.current);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseEnter = (e: Event) => {
      const target = (e.target as HTMLElement).closest(SUGGESTION_SELECTOR) as HTMLElement | null;
      if (target) showPopover(target);
    };

    const handleMouseLeave = (e: Event) => {
      const target = (e.target as HTMLElement).closest(SUGGESTION_SELECTOR) as HTMLElement | null;
      if (target) scheduleHide();
    };

    container.addEventListener('mouseenter', handleMouseEnter, true);
    container.addEventListener('mouseleave', handleMouseLeave, true);

    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter, true);
      container.removeEventListener('mouseleave', handleMouseLeave, true);
      clearTimeout(hideTimeout.current);
    };
  }, [containerRef, showPopover, scheduleHide]);

  if (!activeSuggestion || !position) return null;

  const isProcessing = processingIds.has(activeSuggestion.id);

  const categoryColors: Record<string, string> = {
    content: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    clarity: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
    structure: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    formatting: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
    updates: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  };

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-50 border border-border rounded-lg bg-background shadow-lg overflow-hidden"
      style={{ top: position.top, left: position.left, maxWidth: 320, transform: 'translateY(-100%)' }}
      onMouseEnter={cancelHide}
      onMouseLeave={scheduleHide}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <p className="text-[12px] font-medium text-foreground leading-snug flex-1 min-w-0">
          {activeSuggestion.description}
        </p>
        {activeSuggestion.category && (
          <Badge
            variant="secondary"
            className={`text-[10px] px-1.5 py-0 shrink-0 ${categoryColors[activeSuggestion.category] ?? ''}`}
          >
            {activeSuggestion.category}
          </Badge>
        )}
      </div>

      {activeSuggestion.rationale && (
        <div className="px-3 pb-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {activeSuggestion.rationale}
          </p>
        </div>
      )}

      <div className="flex items-center justify-end gap-1.5 px-3 py-1.5 border-t border-border/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onReject(activeSuggestion.id)}
          disabled={isProcessing}
          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10"
        >
          <X size={10} className="mr-0.5" />
          Reject
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAccept(activeSuggestion.id)}
          disabled={isProcessing}
          className="h-6 px-2 text-[11px] text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-500/10"
        >
          {isProcessing ? (
            <Spinner className="mr-0.5 h-2.5 w-2.5" />
          ) : (
            <Check size={10} className="mr-0.5" />
          )}
          Accept
        </Button>
      </div>
    </div>,
    document.body,
  );
}
