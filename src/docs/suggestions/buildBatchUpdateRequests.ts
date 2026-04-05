/**
 * Builds Google Docs API batchUpdate requests from suggestion parts.
 *
 * Uses `replaceAllText` for text-based replacements (no position mapping needed).
 */

export interface SuggestionPartForUpdate {
  changeType: string;
  original: string | null;
  proposed: string | null;
}

export function buildBatchUpdateRequests(
  parts: SuggestionPartForUpdate[],
): Record<string, unknown>[] {
  const requests: Record<string, unknown>[] = [];

  for (const part of parts) {
    if (
      (part.changeType === 'replace' || part.changeType === 'delete') &&
      part.original
    ) {
      requests.push({
        replaceAllText: {
          containsText: { text: part.original, matchCase: true },
          replaceText: part.changeType === 'delete' ? '' : (part.proposed ?? ''),
        },
      });
    }
    // 'insert' without positional info is skipped — replaceAllText can't insert at arbitrary positions
  }

  return requests;
}
