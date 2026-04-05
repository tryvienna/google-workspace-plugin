/**
 * DocsDocumentDrawer — Entity drawer for Google Docs documents.
 *
 * Two views managed via local state:
 *   1. Document view: rendered doc with inline suggestion marks + hover popovers.
 *      Header shows "Suggestions (N)" button when suggestions exist.
 *   2. Suggestions view: full list with bulk actions.
 *      Uses DrawerContainer's built-in back button (showBackButton + onBack).
 */

import { useState, useCallback } from 'react';
import { DrawerPanelFooter, Button, Badge } from '@tryvienna/ui';
import { ExternalLink, Sparkles } from 'lucide-react';
import { openExternalUrl } from '../openExternal';
import { parseEntityURI } from '@tryvienna/sdk';
import type { EntityDrawerProps } from '@tryvienna/sdk';
import { DOCS_DOCUMENT_URI_PATH } from '../entities/uri';
import { useDocsSuggestions } from '../docs/suggestions/useDocsSuggestions';
import { SuggestionsPanel } from '../docs/suggestions/SuggestionsPanel';
import { DocsViewer } from './DocsViewer';

type DrawerView = 'document' | 'suggestions';

export function DocsDocumentDrawer({ uri, headerActions, DrawerContainer, refreshKey: externalRefreshKey }: EntityDrawerProps) {
  const { id } = parseEntityURI(uri, DOCS_DOCUMENT_URI_PATH);
  const documentId = id['documentId'] ?? '';
  const docsUrl = `https://docs.google.com/document/d/${documentId}/edit`;

  const [view, setView] = useState<DrawerView>('document');

  const [refetchKey, setRefetchKey] = useState(0);
  const handleDocumentChanged = useCallback(() => {
    setRefetchKey((k) => k + 1);
  }, []);

  const {
    suggestions,
    pendingCount,
    hasSuggestions,
    processingIds,
    isProcessingAll,
    acceptSuggestion,
    rejectSuggestion,
    acceptAll,
    rejectAll,
    clear,
  } = useDocsSuggestions({
    documentId,
    onDocumentChanged: handleDocumentChanged,
  });

  if (view === 'suggestions') {
    return (
      <DrawerContainer
        title="Suggestions"
        showBackButton
        onBack={() => setView('document')}
        headerActions={headerActions}
        footer={
          <DrawerPanelFooter className="py-2">
            <span className="text-[11px] text-muted-foreground">
              {pendingCount} pending suggestion{pendingCount !== 1 ? 's' : ''}
            </span>
          </DrawerPanelFooter>
        }
      >
        <SuggestionsPanel
          suggestions={suggestions}
          processingIds={processingIds}
          isProcessingAll={isProcessingAll}
          onAccept={acceptSuggestion}
          onReject={rejectSuggestion}
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
          onClear={clear}
          defaultExpanded
        />
      </DrawerContainer>
    );
  }

  return (
    <DrawerContainer
      title="Google Doc"
      headerActions={
        <>
          {hasSuggestions && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('suggestions')}
              className="h-7 px-2 text-[12px] gap-1"
            >
              <Sparkles size={12} className="text-amber-500" />
              Suggestions
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">
                {pendingCount}
              </Badge>
            </Button>
          )}
          {headerActions}
        </>
      }
      footer={
        <DrawerPanelFooter className="py-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openExternalUrl(docsUrl)}
            >
              <ExternalLink size={12} className="mr-1" />
              Open in Docs
            </Button>
          </div>
        </DrawerPanelFooter>
      }
    >
      <DocsViewer
        documentId={documentId}
        suggestions={suggestions}
        processingIds={processingIds}
        onAccept={acceptSuggestion}
        onReject={rejectSuggestion}
        refetchKey={refetchKey + (externalRefreshKey ?? 0)}
      />
    </DrawerContainer>
  );
}
