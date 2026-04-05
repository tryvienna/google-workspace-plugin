/**
 * Unit tests for AI suggestion types, utilities, and marks.
 */

import { describe, it, expect } from 'vitest';
import {
  generateSuggestionId,
  generatePartId,
  createSuggestion,
  createSuggestionPart,
  computeTextDiff,
  getSuggestionStatus,
  countPendingParts,
  hasPendingParts,
  getSuggestionStats,
} from '../docs/suggestions/types';
import type {
  DocsSuggestion,
  SuggestionPart,
} from '../docs/suggestions/types';

// ─────────────────────────────────────────────────────────────────────────────
// ID Generation
// ─────────────────────────────────────────────────────────────────────────────

describe('generateSuggestionId', () => {
  it('generates unique IDs with sug_ prefix', () => {
    const id1 = generateSuggestionId();
    const id2 = generateSuggestionId();
    expect(id1).toMatch(/^sug_\d+_/);
    expect(id1).not.toBe(id2);
  });
});

describe('generatePartId', () => {
  it('generates unique IDs with part_ prefix', () => {
    const id1 = generatePartId();
    const id2 = generatePartId();
    expect(id1).toMatch(/^part_\d+_/);
    expect(id1).not.toBe(id2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────────────────────

describe('createSuggestion', () => {
  it('creates a suggestion with defaults', () => {
    const part = createSuggestionPart({
      changeType: 'replace',
      from: 10,
      to: 20,
      original: 'old',
      proposed: 'new',
    });
    const sug = createSuggestion({ parts: [part] });

    expect(sug.id).toMatch(/^sug_/);
    expect(sug.description).toBe('AI Suggestion');
    expect(sug.source).toBe('on-demand');
    expect(sug.status).toBe('pending');
    expect(sug.parts).toHaveLength(1);
    expect(sug.createdAt).toBeInstanceOf(Date);
  });

  it('allows overriding defaults', () => {
    const part = createSuggestionPart({ changeType: 'insert', from: 0, to: 0 });
    const sug = createSuggestion({
      id: 'custom-id',
      description: 'Fix grammar',
      source: 'proactive',
      confidence: 0.95,
      category: 'clarity',
      parts: [part],
    });

    expect(sug.id).toBe('custom-id');
    expect(sug.description).toBe('Fix grammar');
    expect(sug.source).toBe('proactive');
    expect(sug.confidence).toBe(0.95);
    expect(sug.category).toBe('clarity');
  });
});

describe('createSuggestionPart', () => {
  it('creates a part with defaults', () => {
    const part = createSuggestionPart({
      changeType: 'delete',
      from: 5,
      to: 15,
    });

    expect(part.id).toMatch(/^part_/);
    expect(part.status).toBe('pending');
    expect(part.granularity).toBe('sentence');
    expect(part.original).toBeNull();
    expect(part.proposed).toBeNull();
    expect(part.changeType).toBe('delete');
    expect(part.from).toBe(5);
    expect(part.to).toBe(15);
  });

  it('respects provided values', () => {
    const part = createSuggestionPart({
      id: 'p1',
      changeType: 'replace',
      from: 0,
      to: 10,
      original: 'hello',
      proposed: 'hi',
      granularity: 'word',
      status: 'accepted',
    });

    expect(part.id).toBe('p1');
    expect(part.status).toBe('accepted');
    expect(part.granularity).toBe('word');
    expect(part.original).toBe('hello');
    expect(part.proposed).toBe('hi');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeTextDiff
// ─────────────────────────────────────────────────────────────────────────────

describe('computeTextDiff', () => {
  it('handles identical text', () => {
    const diff = computeTextDiff('hello world', 'hello world');
    // Adjacent unchanged segments get merged
    expect(diff).toEqual([{ type: 'unchanged', text: 'hello world' }]);
  });

  it('detects insertions', () => {
    const diff = computeTextDiff('hello world', 'hello beautiful world');
    const inserted = diff.filter((s) => s.type === 'inserted');
    expect(inserted.length).toBeGreaterThan(0);
    expect(inserted.some((s) => s.text.includes('beautiful'))).toBe(true);
  });

  it('detects deletions', () => {
    const diff = computeTextDiff('hello beautiful world', 'hello world');
    const deleted = diff.filter((s) => s.type === 'deleted');
    expect(deleted.length).toBeGreaterThan(0);
    expect(deleted.some((s) => s.text.includes('beautiful'))).toBe(true);
  });

  it('detects replacements', () => {
    const diff = computeTextDiff('The cat sat', 'The dog sat');
    const deleted = diff.filter((s) => s.type === 'deleted');
    const inserted = diff.filter((s) => s.type === 'inserted');
    expect(deleted.some((s) => s.text.includes('cat'))).toBe(true);
    expect(inserted.some((s) => s.text.includes('dog'))).toBe(true);
  });

  it('handles empty original', () => {
    const diff = computeTextDiff('', 'new text');
    // Empty string splits to [''] which produces a deleted '' + inserted 'new text'
    const inserted = diff.filter((s) => s.type === 'inserted');
    expect(inserted.some((s) => s.text === 'new text')).toBe(true);
  });

  it('handles empty proposed', () => {
    const diff = computeTextDiff('old text', '');
    // All content should appear as deleted
    const deletedText = diff
      .filter((s) => s.type === 'deleted')
      .map((s) => s.text)
      .join('');
    expect(deletedText).toBe('old text');
  });

  it('merges adjacent segments of the same type', () => {
    const diff = computeTextDiff('a b c', 'x y z');
    // Each replacement pair should be merged
    for (const seg of diff) {
      // No adjacent segments of the same type
      const idx = diff.indexOf(seg);
      if (idx > 0) {
        expect(diff[idx - 1].type).not.toBe(seg.type);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Status Utilities
// ─────────────────────────────────────────────────────────────────────────────

function makePart(status: SuggestionPart['status']): SuggestionPart {
  return createSuggestionPart({
    changeType: 'replace',
    from: 0,
    to: 10,
    status,
  });
}

function makeSuggestion(partStatuses: SuggestionPart['status'][]): DocsSuggestion {
  return createSuggestion({
    parts: partStatuses.map((s) => makePart(s)),
  });
}

describe('getSuggestionStatus', () => {
  it('returns accepted when all parts accepted', () => {
    expect(getSuggestionStatus([makePart('accepted'), makePart('accepted')])).toBe('accepted');
  });

  it('returns rejected when all parts rejected', () => {
    expect(getSuggestionStatus([makePart('rejected'), makePart('rejected')])).toBe('rejected');
  });

  it('returns animating when any part is animating', () => {
    expect(getSuggestionStatus([makePart('pending'), makePart('animating')])).toBe('animating');
  });

  it('returns pending for mixed states', () => {
    expect(getSuggestionStatus([makePart('pending'), makePart('accepted')])).toBe('pending');
  });

  it('returns pending for all pending', () => {
    expect(getSuggestionStatus([makePart('pending')])).toBe('pending');
  });
});

describe('countPendingParts', () => {
  it('counts pending parts', () => {
    const sug = makeSuggestion(['pending', 'accepted', 'pending']);
    expect(countPendingParts(sug)).toBe(2);
  });

  it('returns 0 when no pending parts', () => {
    const sug = makeSuggestion(['accepted', 'rejected']);
    expect(countPendingParts(sug)).toBe(0);
  });
});

describe('hasPendingParts', () => {
  it('returns true when pending parts exist', () => {
    expect(hasPendingParts(makeSuggestion(['accepted', 'pending']))).toBe(true);
  });

  it('returns false when no pending parts', () => {
    expect(hasPendingParts(makeSuggestion(['accepted', 'rejected']))).toBe(false);
  });
});

describe('getSuggestionStats', () => {
  it('computes stats for mixed suggestions', () => {
    const suggestions = [
      makeSuggestion(['pending', 'pending']),
      makeSuggestion(['accepted', 'accepted']),
      makeSuggestion(['rejected', 'rejected']),
      makeSuggestion(['pending', 'accepted']),
    ];

    const stats = getSuggestionStats(suggestions);
    expect(stats.total).toBe(4);
    expect(stats.pending).toBe(2); // first and fourth have pending parts
    expect(stats.accepted).toBe(1);
    expect(stats.rejected).toBe(1);
    expect(stats.totalParts).toBe(8);
    expect(stats.pendingParts).toBe(3);
  });

  it('handles empty array', () => {
    const stats = getSuggestionStats([]);
    expect(stats.total).toBe(0);
    expect(stats.pending).toBe(0);
    expect(stats.totalParts).toBe(0);
  });
});

