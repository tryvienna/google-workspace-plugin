/**
 * DocsViewer — Google Docs renderer with inline suggestion highlights.
 *
 * Renders the document read-only with Google-Docs-style inline marks:
 * strikethrough on original text + green proposed text inserted after.
 * Hovering a mark shows a floating popover with description + accept/reject.
 *
 * Suggestion state is managed by the parent (DocsDocumentDrawer).
 */

import { useMemo, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { usePluginQuery } from '@tryvienna/sdk/react';
import { DrawerBody } from '@tryvienna/ui';
import { getDocsViewerExtensions } from '../docs/schema';
import { googleDocsToTipTap } from '../docs/converters';
import { InlineSuggestionPopover } from '../docs/suggestions/InlineSuggestionPopover';
import { findTextInDocument } from '../docs/suggestions/resolveTextPositions';
import type { SuggestionHighlight } from '../docs/schema/highlight-range';
import type { SuggestionCardData } from '../docs/suggestions/SuggestionCard';
import type { Document } from '../docs/types';
import { GET_DOCS_DOCUMENT } from '../client/operations';
import '../docs/styles/docs-viewer.css';

interface DocsViewerProps {
  documentId: string;
  suggestions?: SuggestionCardData[];
  processingIds?: Set<string>;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  /** Increment to trigger document refetch (after accepting a suggestion) */
  refetchKey?: number;
}

const EMPTY_SUGGESTIONS: SuggestionCardData[] = [];
const EMPTY_PROCESSING = new Set<string>();

export function DocsViewer({
  documentId,
  suggestions = EMPTY_SUGGESTIONS,
  processingIds = EMPTY_PROCESSING,
  onAccept,
  onReject,
  refetchKey,
}: DocsViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);

  const { data, loading, error, refetch: refetchDocument } = usePluginQuery<{
    docsDocument: { documentId: string; title: string; rawJson: string } | null;
  }>(GET_DOCS_DOCUMENT, {
    variables: { documentId },
    fetchPolicy: 'cache-and-network',
    skip: !documentId,
  });

  // Refetch when parent signals a document change
  useEffect(() => {
    if (refetchKey && refetchKey > 0) {
      refetchDocument();
    }
  }, [refetchKey, refetchDocument]);

  const editorContent = useMemo(() => {
    if (!data?.docsDocument?.rawJson) return null;
    try {
      const doc = JSON.parse(data.docsDocument.rawJson) as Document;
      const { content } = googleDocsToTipTap(doc);
      return content;
    } catch {
      return null;
    }
  }, [data?.docsDocument?.rawJson]);

  const extensions = useMemo(() => getDocsViewerExtensions(), []);

  const editor = useEditor(
    {
      extensions,
      content: editorContent,
      editable: false,
    },
    [editorContent],
  );

  // Set persistent highlights for all suggestion targets
  useEffect(() => {
    if (!editor) return;

    if (suggestions.length === 0) {
      editor.commands.clearSuggestionHighlights();
      return;
    }

    const highlights: SuggestionHighlight[] = [];
    for (const suggestion of suggestions) {
      for (const part of suggestion.parts) {
        if (!part.original) {
          // Pure insertion with no anchor text: place at end of document
          if (part.proposed && part.changeType === 'insert') {
            const endPos = editor.state.doc.content.size - 1;
            highlights.push({
              suggestionId: suggestion.id,
              from: endPos,
              to: endPos,
              proposed: part.proposed,
              changeType: 'insert',
            });
          }
          continue;
        }

        // Strip newlines that don't exist in TipTap text nodes
        // (paragraph boundaries are structural, not textual)
        const searchText = part.original.replace(/\n/g, '');
        if (!searchText) continue;

        const match = findTextInDocument(editor, searchText);
        if (!match) continue;

        // Detect insertion: proposed text starts with the original
        // (i.e. original is kept, new content is appended)
        const normalizedProposed = part.proposed?.replace(/\n/g, '') ?? null;
        const isInsertion = normalizedProposed && normalizedProposed.startsWith(searchText)
          && normalizedProposed.length > searchText.length;

        if (isInsertion) {
          // Only show the new text as a green widget at the insertion point;
          // trim leading/trailing newlines to avoid excess blank lines between widgets
          const insertedText = part.proposed!.slice(part.original.length).replace(/^\n+|\n+$/g, '');
          highlights.push({
            suggestionId: suggestion.id,
            from: match.to,
            to: match.to,
            proposed: insertedText,
            changeType: 'insert',
          });
        } else {
          highlights.push({
            suggestionId: suggestion.id,
            from: match.from,
            to: match.to,
            proposed: part.proposed,
            changeType: part.changeType,
          });
        }
      }
    }

    editor.commands.setSuggestionHighlights(highlights);
  }, [editor, suggestions]);

  const wordCount = useMemo(() => {
    if (!editor) return 0;
    const text = editor.state.doc.textContent;
    return text.split(/\s+/).filter((w) => w.length > 0).length;
  }, [editor?.state.doc.textContent]);

  if (loading && !data) {
    return (
      <DrawerBody>
        <div className="space-y-3 animate-pulse py-4">
          <div className="h-6 w-3/4 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-5/6 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-2/3 bg-muted rounded" />
        </div>
      </DrawerBody>
    );
  }

  if (error) {
    return (
      <DrawerBody>
        <div className="flex flex-col items-center gap-2 py-8">
          <span className="text-sm text-muted-foreground">Failed to load document</span>
          <span className="text-xs text-muted-foreground">{error.message}</span>
        </div>
      </DrawerBody>
    );
  }

  if (!editorContent) {
    return (
      <DrawerBody>
        <div className="flex flex-col items-center gap-2 py-8">
          <span className="text-sm text-muted-foreground">Unable to render document</span>
        </div>
      </DrawerBody>
    );
  }

  return (
    <>
      <DrawerBody className="p-0">
        <div
          ref={viewerRef}
          className="vienna-docs-viewer px-4"
          data-nano-file-path={`google-docs://${documentId}`}
        >
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <div className="text-sm text-muted-foreground">Loading viewer...</div>
          )}
        </div>
      </DrawerBody>

      {/* Inline popover on hover of highlighted text */}
      {suggestions.length > 0 && onAccept && onReject && (
        <InlineSuggestionPopover
          suggestions={suggestions}
          containerRef={viewerRef}
          processingIds={processingIds}
          onAccept={onAccept}
          onReject={onReject}
        />
      )}

      <div className="flex items-center justify-between px-4 py-2 border-t">
        <span className="text-[11px] text-muted-foreground">{wordCount} words</span>
      </div>
    </>
  );
}
