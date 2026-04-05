/**
 * Unit tests for the suggestion store — in-memory cache + JSON file persistence.
 *
 * Mocks node:fs so no real files are touched.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock fs ──────────────────────────────────────────────────────────────────

let mockFileContents: Record<string, string> = {};
let mockDirsCreated: string[] = [];

vi.mock('node:fs', () => ({
  existsSync: vi.fn((p: string) => p in mockFileContents || mockDirsCreated.includes(p)),
  readFileSync: vi.fn((p: string) => {
    if (p in mockFileContents) return mockFileContents[p];
    throw new Error(`ENOENT: no such file or directory '${p}'`);
  }),
  writeFileSync: vi.fn((p: string, data: string) => {
    mockFileContents[p] = data;
  }),
  mkdirSync: vi.fn((p: string) => {
    mockDirsCreated.push(p);
  }),
}));

// Reset module state between tests (the store has module-level cache)
beforeEach(async () => {
  mockFileContents = {};
  mockDirsCreated = [];
  vi.resetModules();
});

async function getStore() {
  return await import('../suggestion-store');
}

// ─────────────────────────────────────────────────────────────────────────────
// getSuggestions
// ─────────────────────────────────────────────────────────────────────────────

describe('getSuggestions', () => {
  it('returns empty array for unknown document', async () => {
    const store = await getStore();
    expect(store.getSuggestions('doc-unknown')).toEqual([]);
  });

  it('loads from disk on first access', async () => {
    // Pre-populate the mock file
    const filePath = Object.keys(mockFileContents).length === 0
      ? expect.any(String)
      : '';
    const data = {
      'doc-1': [{
        id: 'sug_1',
        documentId: 'doc-1',
        description: 'Fix typo',
        source: 'on-demand',
        status: 'pending',
        parts: [{
          id: 'part_1',
          status: 'pending',
          changeType: 'replace',
          granularity: 'word',
          original: 'teh',
          proposed: 'the',
        }],
        createdAt: '2026-01-01T00:00:00.000Z',
      }],
    };

    // Write mock data to the expected file path
    const os = await import('node:os');
    const path = await import('node:path');
    const expectedPath = path.join(os.homedir(), '.vienna', 'plugin-data', 'google_workspace', 'suggestions.json');
    mockFileContents[expectedPath] = JSON.stringify(data);
    // Mark parent dir as existing
    mockDirsCreated.push(path.join(os.homedir(), '.vienna', 'plugin-data', 'google_workspace'));

    const store = await getStore();
    const result = store.getSuggestions('doc-1');
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Fix typo');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addSuggestions
// ─────────────────────────────────────────────────────────────────────────────

describe('addSuggestions', () => {
  it('adds suggestions with generated IDs', async () => {
    const store = await getStore();
    const added = store.addSuggestions('doc-1', [{
      description: 'Improve clarity',
      parts: [{
        original: 'bad sentence',
        proposed: 'good sentence',
        changeType: 'replace',
      }],
    }]);

    expect(added).toHaveLength(1);
    expect(added[0].id).toMatch(/^sug_/);
    expect(added[0].documentId).toBe('doc-1');
    expect(added[0].status).toBe('pending');
    expect(added[0].parts[0].id).toMatch(/^part_/);
    expect(added[0].parts[0].status).toBe('pending');
    expect(added[0].parts[0].granularity).toBe('sentence'); // default
  });

  it('appends to existing suggestions', async () => {
    const store = await getStore();
    store.addSuggestions('doc-1', [{
      description: 'First',
      parts: [{ original: 'a', proposed: 'b', changeType: 'replace' }],
    }]);
    store.addSuggestions('doc-1', [{
      description: 'Second',
      parts: [{ original: 'c', proposed: 'd', changeType: 'replace' }],
    }]);

    const all = store.getSuggestions('doc-1');
    expect(all).toHaveLength(2);
    expect(all[0].description).toBe('First');
    expect(all[1].description).toBe('Second');
  });

  it('persists to disk after adding', async () => {
    const { writeFileSync } = await import('node:fs');
    const store = await getStore();
    store.addSuggestions('doc-1', [{
      description: 'Test',
      parts: [{ original: 'x', proposed: 'y', changeType: 'replace' }],
    }]);

    expect(writeFileSync).toHaveBeenCalled();
  });

  it('uses provided source and category', async () => {
    const store = await getStore();
    const [sug] = store.addSuggestions('doc-1', [{
      description: 'Proactive fix',
      source: 'proactive',
      category: 'clarity',
      confidence: 0.9,
      parts: [{ original: 'a', proposed: 'b', changeType: 'replace' }],
    }]);

    expect(sug.source).toBe('proactive');
    expect(sug.category).toBe('clarity');
    expect(sug.confidence).toBe(0.9);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateSuggestionStatus
// ─────────────────────────────────────────────────────────────────────────────

describe('updateSuggestionStatus', () => {
  it('updates a specific part status', async () => {
    const store = await getStore();
    const [sug] = store.addSuggestions('doc-1', [{
      description: 'Test',
      parts: [
        { original: 'a', proposed: 'b', changeType: 'replace' },
        { original: 'c', proposed: 'd', changeType: 'replace' },
      ],
    }]);

    const result = store.updateSuggestionStatus('doc-1', sug.id, sug.parts[0].id, 'accepted');
    expect(result).toBe(true);

    const updated = store.getSuggestions('doc-1');
    expect(updated[0].parts[0].status).toBe('accepted');
    expect(updated[0].parts[1].status).toBe('pending');
    expect(updated[0].status).toBe('pending'); // mixed → still pending
  });

  it('updates all pending parts when partId is null', async () => {
    const store = await getStore();
    const [sug] = store.addSuggestions('doc-1', [{
      description: 'Test',
      parts: [
        { original: 'a', proposed: 'b', changeType: 'replace' },
        { original: 'c', proposed: 'd', changeType: 'replace' },
      ],
    }]);

    store.updateSuggestionStatus('doc-1', sug.id, null, 'rejected');

    const updated = store.getSuggestions('doc-1');
    expect(updated[0].parts.every(p => p.status === 'rejected')).toBe(true);
    expect(updated[0].status).toBe('rejected');
  });

  it('derives accepted status when all parts accepted', async () => {
    const store = await getStore();
    const [sug] = store.addSuggestions('doc-1', [{
      description: 'Test',
      parts: [
        { original: 'a', proposed: 'b', changeType: 'replace' },
        { original: 'c', proposed: 'd', changeType: 'replace' },
      ],
    }]);

    store.updateSuggestionStatus('doc-1', sug.id, sug.parts[0].id, 'accepted');
    store.updateSuggestionStatus('doc-1', sug.id, sug.parts[1].id, 'accepted');

    const updated = store.getSuggestions('doc-1');
    expect(updated[0].status).toBe('accepted');
  });

  it('returns false for unknown document', async () => {
    const store = await getStore();
    expect(store.updateSuggestionStatus('nope', 'sug_1', null, 'accepted')).toBe(false);
  });

  it('returns false for unknown suggestion', async () => {
    const store = await getStore();
    store.addSuggestions('doc-1', [{
      description: 'Test',
      parts: [{ original: 'a', proposed: 'b', changeType: 'replace' }],
    }]);

    expect(store.updateSuggestionStatus('doc-1', 'sug_nonexistent', null, 'accepted')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// clearSuggestions
// ─────────────────────────────────────────────────────────────────────────────

describe('clearSuggestions', () => {
  it('removes all suggestions for a document', async () => {
    const store = await getStore();
    store.addSuggestions('doc-1', [{
      description: 'Test',
      parts: [{ original: 'a', proposed: 'b', changeType: 'replace' }],
    }]);

    expect(store.clearSuggestions('doc-1')).toBe(true);
    expect(store.getSuggestions('doc-1')).toEqual([]);
  });

  it('returns false for unknown document', async () => {
    const store = await getStore();
    expect(store.clearSuggestions('doc-unknown')).toBe(false);
  });

  it('does not affect other documents', async () => {
    const store = await getStore();
    store.addSuggestions('doc-1', [{
      description: 'One',
      parts: [{ original: 'a', proposed: 'b', changeType: 'replace' }],
    }]);
    store.addSuggestions('doc-2', [{
      description: 'Two',
      parts: [{ original: 'c', proposed: 'd', changeType: 'replace' }],
    }]);

    store.clearSuggestions('doc-1');
    expect(store.getSuggestions('doc-1')).toEqual([]);
    expect(store.getSuggestions('doc-2')).toHaveLength(1);
  });
});
