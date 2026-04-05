import type { Meta, StoryObj } from '@storybook/react';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  DrawerPanel,
  DrawerPanelContent,
  DrawerPanelFooter,
  DrawerBody,
  Button,
  Badge,
} from '@tryvienna/ui';
import { SuggestionsPanel } from '../docs/suggestions/SuggestionsPanel';
import { InlineSuggestionPopover } from '../docs/suggestions/InlineSuggestionPopover';
import type { SuggestionCardData } from '../docs/suggestions/SuggestionCard';
import { findTextInDocument } from '../docs/suggestions/resolveTextPositions';
import { HighlightRange } from '../docs/schema/highlight-range';
import type { SuggestionHighlight } from '../docs/schema/highlight-range';
import { Sparkles, ChevronLeft, ExternalLink, X, RefreshCw } from 'lucide-react';
import { mockSuggestions } from './mock-data';
import '../docs/styles/docs-viewer.css';

/**
 * Full Google Docs drawer demo matching Vienna's actual drawer chrome.
 *
 * Header layout mirrors ContainerHeader: [Back] [Title] [Actions] [Refresh] [Close]
 * Back button uses ChevronLeft (matching Vienna's drawer convention).
 */

const DOC_CONTENT = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Q3 Product Roadmap' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'It was determined through our analysis that the system performance has been significantly impacted by the recent changes. The team have been working on this since last month.',
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Requirements' }],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Users should be able to log in with SSO' }] },
          ],
        },
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'The system needs to handle concurrent requests' }] },
          ],
        },
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'It would be good if we had audit logging' }] },
          ],
        },
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'The API supports up to 1000 requests per minute.' }] },
          ],
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Deployment Strategy' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'We will use a blue-green deployment strategy with automated rollback capabilities. Canary releases will target 5% of traffic before full promotion.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'The deployment process involves pushing to staging first, then production. We use a blue-green deployment strategy to minimize downtime.',
        },
      ],
    },
  ],
};

// ── Vienna-style drawer header ──────────────────────────────────────────────
// Mirrors ContainerHeader layout: [Back] [Title] ... [Actions] [Refresh] [Close]

function DrawerHeader({
  title,
  showBack,
  onBack,
  actions,
}: {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div
      data-slot="drawer-header"
      className="flex items-center gap-1.5 px-2 py-2 border-b border-border shrink-0"
    >
      {showBack && (
        <button
          onClick={onBack}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft size={16} />
        </button>
      )}
      <span className="text-sm font-medium flex-1 truncate px-1">{title}</span>
      {actions}
      <button
        className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Refresh"
      >
        <RefreshCw size={14} />
      </button>
      <button
        className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Close drawer"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Main demo ───────────────────────────────────────────────────────────────

type DrawerView = 'document' | 'suggestions';

function InteractiveDemo() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<DrawerView>('document');
  const [suggestions, setSuggestions] = useState<SuggestionCardData[]>(mockSuggestions);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  const extensions = useMemo(
    () => [StarterKit.configure({ history: false }), HighlightRange],
    [],
  );

  const editor = useEditor({
    extensions,
    content: DOC_CONTENT,
    editable: false,
  });

  useEffect(() => {
    if (!editor) return;

    if (suggestions.length === 0) {
      editor.commands.clearSuggestionHighlights();
      return;
    }

    const highlights: SuggestionHighlight[] = [];
    for (const suggestion of suggestions) {
      for (const part of suggestion.parts) {
        if (!part.original) continue;

        const match = findTextInDocument(editor, part.original);
        if (!match) continue;

        highlights.push({
          suggestionId: suggestion.id,
          from: match.from,
          to: match.to,
          proposed: part.proposed,
          changeType: part.changeType,
        });
      }
    }

    editor.commands.setSuggestionHighlights(highlights);
  }, [editor, suggestions]);

  const handleAccept = useCallback((id: string) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 800);
  }, []);

  const handleReject = useCallback((id: string) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 400);
  }, []);

  const handleAcceptAll = useCallback(() => {
    setIsProcessingAll(true);
    setTimeout(() => {
      setSuggestions([]);
      setIsProcessingAll(false);
    }, 1200);
  }, []);

  const handleRejectAll = useCallback(() => {
    setIsProcessingAll(true);
    setTimeout(() => {
      setSuggestions([]);
      setIsProcessingAll(false);
    }, 600);
  }, []);

  const handleClear = useCallback(() => {
    setSuggestions([]);
  }, []);

  const handleReset = useCallback(() => {
    setSuggestions(mockSuggestions);
    setView('document');
  }, []);

  const count = suggestions.length;

  // ── Suggestions view ──────────────────────────────────────────────────────
  if (view === 'suggestions') {
    return (
      <DrawerPanel style={{ width: 480, height: 600 }}>
        <DrawerHeader
          title="Suggestions"
          showBack
          onBack={() => setView('document')}
        />

        <DrawerPanelContent>
          <SuggestionsPanel
            suggestions={suggestions}
            processingIds={processingIds}
            isProcessingAll={isProcessingAll}
            onAccept={handleAccept}
            onReject={handleReject}
            onAcceptAll={handleAcceptAll}
            onRejectAll={handleRejectAll}
            onClear={handleClear}
            defaultExpanded
          />
        </DrawerPanelContent>

        <DrawerPanelFooter className="py-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {count} pending suggestion{count !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleReset}
              className="text-[11px] text-muted-foreground hover:text-foreground underline"
            >
              Reset demo
            </button>
          </div>
        </DrawerPanelFooter>
      </DrawerPanel>
    );
  }

  // ── Document view ─────────────────────────────────────────────────────────
  return (
    <DrawerPanel style={{ width: 480, height: 600 }}>
      <DrawerHeader
        title="Google Doc"
        actions={
          count > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('suggestions')}
              className="h-7 px-2 text-[12px] gap-1"
            >
              <Sparkles size={12} className="text-amber-500" />
              Suggestions
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">
                {count}
              </Badge>
            </Button>
          ) : undefined
        }
      />

      <DrawerPanelContent>
        <DrawerBody className="p-0">
          <div ref={viewerRef} className="vienna-docs-viewer px-4">
            {editor && <EditorContent editor={editor} />}
          </div>
        </DrawerBody>
      </DrawerPanelContent>

      {/* Inline popover on hover */}
      {count > 0 && (
        <InlineSuggestionPopover
          suggestions={suggestions}
          containerRef={viewerRef}
          processingIds={processingIds}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}

      <DrawerPanelFooter className="py-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">199 words</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" asChild>
              <a href="#" onClick={(e) => e.preventDefault()}>
                <ExternalLink size={10} className="mr-1" />
                Open in Docs
              </a>
            </Button>
            <button
              onClick={handleReset}
              className="text-[11px] text-muted-foreground hover:text-foreground underline"
            >
              Reset demo
            </button>
          </div>
        </div>
      </DrawerPanelFooter>
    </DrawerPanel>
  );
}

const meta = {
  title: 'Showcase/Google Docs with Suggestions',
  component: InteractiveDemo,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Google Docs entity drawer matching Vienna\'s drawer chrome. Header layout: [Back] [Title] [Actions] [Refresh] [Close]. Inline suggestion marks with hover popovers. "Suggestions" header button navigates to the list view with a back arrow.',
      },
    },
  },
} satisfies Meta<typeof InteractiveDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  name: 'Interactive Demo',
};
