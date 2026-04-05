/**
 * SuggestionStore — Persists document suggestions to a JSON file with in-memory cache.
 *
 * Suggestions are keyed by documentId. Each document can have multiple suggestions,
 * each containing one or more parts (atomic text changes).
 *
 * The store is designed to be called from GraphQL resolvers. It's fast (in-memory Map)
 * with a JSON file for cross-restart persistence.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// ── Types ────────────────────────────────────────────────────────────────────

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected';

export interface StoredSuggestionPart {
  id: string;
  status: SuggestionStatus;
  changeType: 'insert' | 'delete' | 'replace' | 'format';
  granularity: 'word' | 'sentence' | 'paragraph' | 'block';
  /** Original text in the document (null for insertions) */
  original: string | null;
  /** Proposed replacement text (null for deletions) */
  proposed: string | null;
}

export interface StoredSuggestion {
  id: string;
  documentId: string;
  description: string;
  rationale?: string;
  source: 'proactive' | 'on-demand' | 'context';
  category?: 'content' | 'formatting' | 'structure' | 'clarity' | 'updates';
  confidence?: number;
  status: SuggestionStatus;
  parts: StoredSuggestionPart[];
  createdAt: string; // ISO 8601
}

// ── Input types (for mutations) ──────────────────────────────────────────────

export interface SuggestionPartInput {
  original: string | null;
  proposed: string | null;
  changeType: 'insert' | 'delete' | 'replace' | 'format';
  granularity?: 'word' | 'sentence' | 'paragraph' | 'block';
}

export interface SuggestionInput {
  description: string;
  rationale?: string;
  source?: 'proactive' | 'on-demand' | 'context';
  category?: 'content' | 'formatting' | 'structure' | 'clarity' | 'updates';
  confidence?: number;
  parts: SuggestionPartInput[];
}

// ── Store ────────────────────────────────────────────────────────────────────

/** In-memory cache: documentId → suggestions */
const cache = new Map<string, StoredSuggestion[]>();
let loaded = false;

function getDataDir(): string {
  const dir = join(homedir(), '.vienna', 'plugin-data', 'google_workspace');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getFilePath(): string {
  return join(getDataDir(), 'suggestions.json');
}

function loadFromDisk(): void {
  if (loaded) return;
  loaded = true;

  const filePath = getFilePath();
  if (!existsSync(filePath)) return;

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, StoredSuggestion[]>;
    for (const [docId, suggestions] of Object.entries(data)) {
      cache.set(docId, suggestions);
    }
  } catch {
    // Corrupted file — start fresh
  }
}

function saveToDisk(): void {
  const data: Record<string, StoredSuggestion[]> = {};
  for (const [docId, suggestions] of cache) {
    if (suggestions.length > 0) {
      data[docId] = suggestions;
    }
  }

  try {
    writeFileSync(getFilePath(), JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Best-effort persistence — don't crash if write fails
  }
}

let idCounter = 0;
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${(++idCounter).toString(36)}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getSuggestions(documentId: string): StoredSuggestion[] {
  loadFromDisk();
  return cache.get(documentId) ?? [];
}

export function addSuggestions(
  documentId: string,
  inputs: SuggestionInput[],
): StoredSuggestion[] {
  loadFromDisk();

  const existing = cache.get(documentId) ?? [];
  const added: StoredSuggestion[] = [];

  for (const input of inputs) {
    const suggestion: StoredSuggestion = {
      id: generateId('sug'),
      documentId,
      description: input.description,
      rationale: input.rationale,
      source: input.source ?? 'on-demand',
      category: input.category,
      confidence: input.confidence,
      status: 'pending',
      parts: input.parts.map((p) => ({
        id: generateId('part'),
        status: 'pending' as const,
        changeType: p.changeType,
        granularity: p.granularity ?? 'sentence',
        original: p.original,
        proposed: p.proposed,
      })),
      createdAt: new Date().toISOString(),
    };
    added.push(suggestion);
  }

  cache.set(documentId, [...existing, ...added]);
  saveToDisk();
  return added;
}

export function updateSuggestionStatus(
  documentId: string,
  suggestionId: string,
  partId: string | null,
  status: SuggestionStatus,
): boolean {
  loadFromDisk();

  const suggestions = cache.get(documentId);
  if (!suggestions) return false;

  const sug = suggestions.find((s) => s.id === suggestionId);
  if (!sug) return false;

  if (partId) {
    const part = sug.parts.find((p) => p.id === partId);
    if (!part) return false;
    part.status = status;
  } else {
    sug.parts.forEach((p) => {
      if (p.status === 'pending') p.status = status;
    });
  }

  // Derive overall status
  if (sug.parts.every((p) => p.status === 'accepted')) {
    sug.status = 'accepted';
  } else if (sug.parts.every((p) => p.status === 'rejected')) {
    sug.status = 'rejected';
  } else {
    sug.status = 'pending';
  }

  saveToDisk();
  return true;
}

export function clearSuggestions(documentId: string): boolean {
  loadFromDisk();
  const had = cache.has(documentId);
  cache.delete(documentId);
  if (had) saveToDisk();
  return had;
}
