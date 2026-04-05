/**
 * useDocsSuggestions — pure data hook for managing Google Docs suggestions.
 *
 * No TipTap editor integration. Handles fetching, accept/reject with
 * actual Google Docs API updates via batchUpdate, and local state management.
 */

import { useState, useCallback, useMemo } from 'react';
import { usePluginQuery, usePluginMutation } from '@tryvienna/sdk/react';
import {
  GET_DOC_SUGGESTIONS,
  UPDATE_SUGGESTION_STATUS,
  CLEAR_DOC_SUGGESTIONS,
  BATCH_UPDATE_DOCUMENT,
} from '../../client/operations';
import { buildBatchUpdateRequests } from './buildBatchUpdateRequests';

// ── Types ────────────────────────────────────────────────────────────────────

export interface StoredSuggestionPart {
  id: string;
  status: string;
  changeType: string;
  granularity: string;
  original: string | null;
  proposed: string | null;
}

export interface StoredSuggestionData {
  id: string;
  documentId: string;
  description: string;
  rationale?: string;
  source: string;
  category?: string;
  confidence?: number;
  status: string;
  createdAt: string;
  parts: StoredSuggestionPart[];
}

export interface UseDocsSuggestionsOptions {
  documentId: string;
  /** Called after a suggestion is accepted and the doc should be refetched */
  onDocumentChanged?: () => void;
}

export interface UseDocsSuggestionsReturn {
  suggestions: StoredSuggestionData[];
  pendingCount: number;
  hasSuggestions: boolean;
  processingIds: Set<string>;
  isProcessingAll: boolean;
  acceptSuggestion: (id: string) => Promise<void>;
  rejectSuggestion: (id: string) => Promise<void>;
  acceptAll: () => Promise<void>;
  rejectAll: () => Promise<void>;
  clear: () => Promise<void>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDocsSuggestions({
  documentId,
  onDocumentChanged,
}: UseDocsSuggestionsOptions): UseDocsSuggestionsReturn {
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Fetch suggestions (poll every 5s for new ones from Claude)
  const { data, refetch } = usePluginQuery<{
    docsSuggestions: StoredSuggestionData[];
  }>(GET_DOC_SUGGESTIONS, {
    variables: { documentId },
    fetchPolicy: 'network-only',
    skip: !documentId,
    pollInterval: 5000,
  });

  const [updateStatus] = usePluginMutation(UPDATE_SUGGESTION_STATUS);
  const [batchUpdate] = usePluginMutation(BATCH_UPDATE_DOCUMENT);
  const [clearStore] = usePluginMutation(CLEAR_DOC_SUGGESTIONS);

  // Filter to pending suggestions, excluding dismissed ones
  const suggestions = useMemo(() => {
    const all = data?.docsSuggestions ?? [];
    return all.filter((s) => s.status === 'pending' && !dismissedIds.has(s.id));
  }, [data?.docsSuggestions, dismissedIds]);

  const pendingCount = suggestions.length;
  const hasSuggestions = pendingCount > 0;

  // ── Accept: apply to Google Docs, then mark accepted ─────────────────────

  const acceptSuggestion = useCallback(
    async (id: string) => {
      const suggestion = suggestions.find((s) => s.id === id);
      if (!suggestion) return;

      setProcessingIds((prev) => new Set(prev).add(id));

      try {
        // Build Google Docs API requests from suggestion parts
        const requests = buildBatchUpdateRequests(suggestion.parts);

        if (requests.length > 0) {
          // Actually update the Google Doc
          await batchUpdate({
            variables: {
              documentId,
              requestsJson: JSON.stringify(requests),
            },
          });
        }

        // Mark as accepted in the suggestion store
        await updateStatus({
          variables: { documentId, suggestionId: id, status: 'accepted' },
        });

        // Dismiss from local view
        setDismissedIds((prev) => new Set(prev).add(id));

        // Trigger document refetch so the viewer shows updated content
        onDocumentChanged?.();
      } catch (err) {
        console.error('[google_workspace] Failed to apply suggestion:', err);
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [suggestions, batchUpdate, updateStatus, documentId, onDocumentChanged],
  );

  // ── Reject: just mark rejected ───────────────────────────────────────────

  const rejectSuggestion = useCallback(
    async (id: string) => {
      setProcessingIds((prev) => new Set(prev).add(id));

      try {
        await updateStatus({
          variables: { documentId, suggestionId: id, status: 'rejected' },
        });
        setDismissedIds((prev) => new Set(prev).add(id));
      } catch (err) {
        console.error('[google_workspace] Failed to reject suggestion:', err);
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [updateStatus, documentId],
  );

  // ── Bulk actions ─────────────────────────────────────────────────────────

  const acceptAll = useCallback(async () => {
    setIsProcessingAll(true);

    try {
      // Process sequentially — each batchUpdate changes the doc
      for (const suggestion of suggestions) {
        const requests = buildBatchUpdateRequests(suggestion.parts);

        if (requests.length > 0) {
          await batchUpdate({
            variables: {
              documentId,
              requestsJson: JSON.stringify(requests),
            },
          });
        }

        await updateStatus({
          variables: { documentId, suggestionId: suggestion.id, status: 'accepted' },
        });
      }

      setDismissedIds((prev) => {
        const next = new Set(prev);
        suggestions.forEach((s) => next.add(s.id));
        return next;
      });

      // Single refetch at the end
      onDocumentChanged?.();
    } catch (err) {
      console.error('[google_workspace] Failed to accept all suggestions:', err);
    } finally {
      setIsProcessingAll(false);
    }
  }, [suggestions, batchUpdate, updateStatus, documentId, onDocumentChanged]);

  const rejectAll = useCallback(async () => {
    setIsProcessingAll(true);

    try {
      for (const suggestion of suggestions) {
        await updateStatus({
          variables: { documentId, suggestionId: suggestion.id, status: 'rejected' },
        });
      }

      setDismissedIds((prev) => {
        const next = new Set(prev);
        suggestions.forEach((s) => next.add(s.id));
        return next;
      });
    } catch (err) {
      console.error('[google_workspace] Failed to reject all suggestions:', err);
    } finally {
      setIsProcessingAll(false);
    }
  }, [suggestions, updateStatus, documentId]);

  const clear = useCallback(async () => {
    try {
      await clearStore({ variables: { documentId } });
      setDismissedIds(new Set());
      await refetch();
    } catch (err) {
      console.error('[google_workspace] Failed to clear suggestions:', err);
    }
  }, [clearStore, documentId, refetch]);

  return {
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
  };
}
