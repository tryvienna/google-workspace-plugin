/**
 * AI Document Suggestions - Type Definitions
 *
 * Defines the data model for inline AI suggestions in Google Docs.
 * Supports multi-part suggestions where each part can be independently accepted/rejected.
 */

/**
 * Status of a suggestion or suggestion part
 */
export type SuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'animating';

/**
 * Type of change being suggested
 */
export type SuggestionChangeType =
  | 'insert'      // New content being added
  | 'delete'      // Content being removed
  | 'replace'     // Content being replaced (delete + insert)
  | 'format';     // Formatting change only (bold, italic, etc.)

/**
 * Granularity level of a suggestion
 */
export type SuggestionGranularity =
  | 'word'        // Single word or phrase
  | 'sentence'    // Complete sentence
  | 'paragraph'   // Full paragraph
  | 'block';      // Block element (list, table, image, etc.)

/**
 * A single atomic change within a suggestion.
 * Each part can be independently accepted or rejected.
 */
export interface SuggestionPart {
  id: string;
  status: SuggestionStatus;
  changeType: SuggestionChangeType;
  granularity: SuggestionGranularity;
  /** Original content (null for insertions) */
  original: string | null;
  /** Proposed content (null for deletions) */
  proposed: string | null;
  /** Start position in document (TipTap pos) */
  from: number;
  /** End position in document (TipTap pos) */
  to: number;
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    link?: string | null;
  };
}

/**
 * A complete AI suggestion containing one or more parts.
 */
export interface DocsSuggestion {
  id: string;
  description: string;
  rationale?: string;
  source: 'proactive' | 'on-demand' | 'context';
  createdAt: Date;
  parts: SuggestionPart[];
  status: SuggestionStatus;
  confidence?: number;
  category?: 'content' | 'formatting' | 'structure' | 'clarity' | 'updates';
}

export interface DocumentRange {
  from: number;
  to: number;
}

export interface DiffSegment {
  type: 'unchanged' | 'deleted' | 'inserted';
  text: string;
}

export interface SuggestionDisplayProps {
  suggestion: DocsSuggestion;
  onAccept?: (suggestionId: string, partId?: string) => void;
  onReject?: (suggestionId: string, partId?: string) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  isHovered?: boolean;
  isFocused?: boolean;
}

export interface SuggestionsState {
  suggestions: DocsSuggestion[];
  focusedId: string | null;
  isGenerating: boolean;
  error: string | null;
}

export interface SuggestionsActions {
  addSuggestion: (suggestion: DocsSuggestion) => void;
  removeSuggestion: (id: string) => void;
  accept: (suggestionId: string, partId?: string) => void;
  reject: (suggestionId: string, partId?: string) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  focus: (id: string | null) => void;
  navigate: (direction: 'next' | 'previous') => void;
  requestSuggestions: () => Promise<void>;
  clear: () => void;
}

// ── Utility Functions ────────────────────────────────────────────────────────

export function generateSuggestionId(): string {
  return `sug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generatePartId(): string {
  return `part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createSuggestion(
  params: Partial<DocsSuggestion> & { parts: SuggestionPart[] },
): DocsSuggestion {
  const { parts, ...rest } = params;
  return {
    id: generateSuggestionId(),
    description: 'AI Suggestion',
    source: 'on-demand',
    createdAt: new Date(),
    status: 'pending',
    ...rest,
    parts,
  };
}

export function createSuggestionPart(
  params: Partial<SuggestionPart> & {
    changeType: SuggestionChangeType;
    from: number;
    to: number;
  },
): SuggestionPart {
  return {
    id: params.id ?? generatePartId(),
    status: params.status ?? 'pending',
    granularity: params.granularity ?? 'sentence',
    original: params.original ?? null,
    proposed: params.proposed ?? null,
    ...params,
  };
}

/**
 * Compute diff segments from original and proposed text (word-level).
 */
export function computeTextDiff(original: string, proposed: string): DiffSegment[] {
  const originalWords = original.split(/(\s+)/);
  const proposedWords = proposed.split(/(\s+)/);
  const segments: DiffSegment[] = [];

  let i = 0;
  let j = 0;

  while (i < originalWords.length || j < proposedWords.length) {
    if (i >= originalWords.length) {
      segments.push({ type: 'inserted', text: proposedWords.slice(j).join('') });
      break;
    }
    if (j >= proposedWords.length) {
      segments.push({ type: 'deleted', text: originalWords.slice(i).join('') });
      break;
    }

    if (originalWords[i] === proposedWords[j]) {
      segments.push({ type: 'unchanged', text: originalWords[i] });
      i++;
      j++;
    } else {
      let foundMatch = false;
      for (let lookAhead = 1; lookAhead < 5; lookAhead++) {
        if (originalWords[i + lookAhead] === proposedWords[j]) {
          segments.push({ type: 'deleted', text: originalWords.slice(i, i + lookAhead).join('') });
          i += lookAhead;
          foundMatch = true;
          break;
        }
        if (originalWords[i] === proposedWords[j + lookAhead]) {
          segments.push({ type: 'inserted', text: proposedWords.slice(j, j + lookAhead).join('') });
          j += lookAhead;
          foundMatch = true;
          break;
        }
      }
      if (!foundMatch) {
        segments.push({ type: 'deleted', text: originalWords[i] });
        segments.push({ type: 'inserted', text: proposedWords[j] });
        i++;
        j++;
      }
    }
  }

  // Merge adjacent segments of the same type
  const merged: DiffSegment[] = [];
  for (const segment of segments) {
    const last = merged[merged.length - 1];
    if (last && last.type === segment.type) {
      last.text += segment.text;
    } else {
      merged.push({ ...segment });
    }
  }

  return merged;
}

export function getSuggestionStatus(parts: SuggestionPart[]): SuggestionStatus {
  if (parts.every((p) => p.status === 'accepted')) return 'accepted';
  if (parts.every((p) => p.status === 'rejected')) return 'rejected';
  if (parts.some((p) => p.status === 'animating')) return 'animating';
  return 'pending';
}

export function countPendingParts(suggestion: DocsSuggestion): number {
  return suggestion.parts.filter((p) => p.status === 'pending').length;
}

export function hasPendingParts(suggestion: DocsSuggestion): boolean {
  return suggestion.parts.some((p) => p.status === 'pending');
}

export function getSuggestionStats(suggestions: DocsSuggestion[]): {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  totalParts: number;
  pendingParts: number;
} {
  let pending = 0;
  let accepted = 0;
  let rejected = 0;
  let totalParts = 0;
  let pendingParts = 0;

  for (const sug of suggestions) {
    totalParts += sug.parts.length;
    pendingParts += countPendingParts(sug);

    if (hasPendingParts(sug)) {
      pending++;
    } else if (sug.parts.every((p) => p.status === 'accepted')) {
      accepted++;
    } else {
      rejected++;
    }
  }

  return { total: suggestions.length, pending, accepted, rejected, totalParts, pendingParts };
}
