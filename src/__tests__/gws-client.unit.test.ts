/**
 * Unit tests for GwsClient — exec, error handling, auth, keyring stripping.
 *
 * Mocks node:child_process.execFile with a custom promisify symbol so that
 * util.promisify(execFile) returns the mock's custom behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promisify } from 'node:util';

/** Stub for the promisified execFile — returns {stdout, stderr}. */
let execFileAsyncStub: ReturnType<typeof vi.fn>;

vi.mock('node:child_process', () => {
  // Create a base function that acts as execFile (callback-style)
  const fn = vi.fn() as any;
  // Attach the custom promisify symbol so util.promisify returns our async stub
  execFileAsyncStub = vi.fn();
  fn[promisify.custom] = execFileAsyncStub;
  return { execFile: fn };
});

import { execFile } from 'node:child_process';

/** Helper: make the mocked execFile resolve with given stdout/stderr. */
function mockExecFile(stdout: string, stderr = '') {
  execFileAsyncStub.mockResolvedValue({ stdout, stderr });
}

/** Helper: make the mocked execFile reject with an error. */
function mockExecFileError(exitCode: number | string, stderr: string, message = 'command failed') {
  const err: any = new Error(message);
  err.code = exitCode;
  err.stderr = stderr;
  execFileAsyncStub.mockRejectedValue(err);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// exec
// ─────────────────────────────────────────────────────────────────────────────

describe('GwsClient.exec', () => {
  // Must import after mock setup
  let GwsClient: typeof import('../gws-client').GwsClient;
  let GwsError: typeof import('../gws-client').GwsError;
  let GwsExitCode: typeof import('../gws-client').GwsExitCode;

  beforeEach(async () => {
    const mod = await import('../gws-client');
    GwsClient = mod.GwsClient;
    GwsError = mod.GwsError;
    GwsExitCode = mod.GwsExitCode;
  });

  it('parses valid JSON output', async () => {
    mockExecFile(JSON.stringify({ token_valid: true, user: 'test@gmail.com' }));
    const client = new GwsClient();
    const result = await client.exec(['auth', 'status']);
    expect(result).toEqual({ token_valid: true, user: 'test@gmail.com' });
  });

  it('strips "Using keyring backend:" prefix before parsing', async () => {
    const json = JSON.stringify({ token_valid: true });
    mockExecFile(`Using keyring backend: keyring\n${json}`);
    const client = new GwsClient();
    const result = await client.exec(['auth', 'status']);
    expect(result).toEqual({ token_valid: true });
  });

  it('strips keyring line even with different backend names', async () => {
    const json = JSON.stringify({ count: 5 });
    mockExecFile(`Using keyring backend: SecretService Keyring\n${json}`);
    const client = new GwsClient();
    const result = await client.exec(['calendar', '+agenda']);
    expect(result).toEqual({ count: 5 });
  });

  it('throws on empty stdout', async () => {
    mockExecFile('');
    const client = new GwsClient();
    await expect(client.exec(['some', 'command'])).rejects.toThrow('Unexpected empty response');
  });

  it('appends --format json when not present', async () => {
    mockExecFile('{}');
    const client = new GwsClient();
    await client.exec(['auth', 'status']);
    expect(execFileAsyncStub).toHaveBeenCalledWith(
      'gws',
      ['auth', 'status', '--format', 'json'],
      expect.any(Object),
    );
  });

  it('does not append --format json when already present', async () => {
    mockExecFile('{}');
    const client = new GwsClient();
    await client.exec(['auth', 'status', '--format', 'text']);
    expect(execFileAsyncStub).toHaveBeenCalledWith(
      'gws',
      ['auth', 'status', '--format', 'text'],
      expect.any(Object),
    );
  });

  it('uses custom binary path', async () => {
    mockExecFile('{}');
    const client = new GwsClient({ binaryPath: '/usr/local/bin/gws' });
    await client.exec(['auth', 'status']);
    expect(execFileAsyncStub).toHaveBeenCalledWith(
      '/usr/local/bin/gws',
      expect.any(Array),
      expect.any(Object),
    );
  });

  it('uses custom timeout', async () => {
    mockExecFile('{}');
    const client = new GwsClient({ timeout: 60_000 });
    await client.exec(['auth', 'status']);
    expect(execFileAsyncStub).toHaveBeenCalledWith(
      'gws',
      expect.any(Array),
      expect.objectContaining({ timeout: 60_000 }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────

describe('GwsClient error handling', () => {
  let GwsClient: typeof import('../gws-client').GwsClient;
  let GwsError: typeof import('../gws-client').GwsError;
  let GwsExitCode: typeof import('../gws-client').GwsExitCode;

  beforeEach(async () => {
    const mod = await import('../gws-client');
    GwsClient = mod.GwsClient;
    GwsError = mod.GwsError;
    GwsExitCode = mod.GwsExitCode;
  });

  it('throws GwsError with auth message for exit code 2', async () => {
    mockExecFileError(2, 'Token expired');
    const client = new GwsClient();
    await expect(client.exec(['gmail', 'users', 'threads', 'list'])).rejects.toThrow(GwsError);
    mockExecFileError(2, 'Token expired');
    await expect(client.exec(['gmail', 'users', 'threads', 'list'])).rejects.toThrow(
      'Not authenticated',
    );
  });

  it('throws GwsError with stderr for other exit codes', async () => {
    mockExecFileError(1, 'Rate limit exceeded');
    const client = new GwsClient();
    try {
      await client.exec(['gmail', 'users', 'threads', 'list']);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(GwsError);
      expect((err as any).exitCode).toBe(1);
      expect((err as any).stderr).toBe('Rate limit exceeded');
    }
  });

  it('handles non-numeric exit code', async () => {
    mockExecFileError('ENOENT', '', 'spawn gws ENOENT');
    const client = new GwsClient();
    try {
      await client.exec(['auth', 'status']);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(GwsError);
      expect((err as any).exitCode).toBe(5); // INTERNAL_ERROR
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

describe('GwsClient.isAuthenticated', () => {
  let GwsClient: typeof import('../gws-client').GwsClient;

  beforeEach(async () => {
    const mod = await import('../gws-client');
    GwsClient = mod.GwsClient;
  });

  it('returns true when token_valid is true', async () => {
    mockExecFile(JSON.stringify({ token_valid: true, user: 'user@gmail.com' }));
    const client = new GwsClient();
    expect(await client.isAuthenticated()).toBe(true);
  });

  it('returns false when token_valid is false', async () => {
    mockExecFile(JSON.stringify({ token_valid: false, token_error: 'Token expired' }));
    const client = new GwsClient();
    expect(await client.isAuthenticated()).toBe(false);
  });

  it('returns false when exec throws', async () => {
    mockExecFileError(5, 'binary not found');
    const client = new GwsClient();
    expect(await client.isAuthenticated()).toBe(false);
  });
});

describe('GwsClient.authStatus', () => {
  let GwsClient: typeof import('../gws-client').GwsClient;

  beforeEach(async () => {
    const mod = await import('../gws-client');
    GwsClient = mod.GwsClient;
  });

  it('returns validated auth status', async () => {
    mockExecFile(
      JSON.stringify({
        auth_method: 'oauth2',
        token_valid: true,
        user: 'user@gmail.com',
        scope_count: 5,
      }),
    );
    const client = new GwsClient();
    const status = await client.authStatus();
    expect(status.token_valid).toBe(true);
    expect(status.user).toBe('user@gmail.com');
    expect(status.auth_method).toBe('oauth2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gmail methods
// ─────────────────────────────────────────────────────────────────────────────

describe('GwsClient Gmail methods', () => {
  let GwsClient: typeof import('../gws-client').GwsClient;

  beforeEach(async () => {
    const mod = await import('../gws-client');
    GwsClient = mod.GwsClient;
  });

  it('gmailThreadsList passes params correctly', async () => {
    mockExecFile(JSON.stringify({ threads: [{ id: 't1' }], resultSizeEstimate: 1 }));
    const client = new GwsClient();
    const result = await client.gmailThreadsList({ q: 'is:unread', maxResults: 10 });
    expect(result.threads).toHaveLength(1);
    const callArgs = execFileAsyncStub.mock.calls[0][1] as string[];
    const paramsJson = callArgs[callArgs.indexOf('--params') + 1];
    const params = JSON.parse(paramsJson);
    expect(params.userId).toBe('me');
    expect(params.q).toBe('is:unread');
  });

  it('gmailThreadsGetMetadata uses format: metadata', async () => {
    mockExecFile(JSON.stringify({ id: 't1', messages: [{ id: 'm1', labelIds: [] }] }));
    const client = new GwsClient();
    await client.gmailThreadsGetMetadata('t1');
    const callArgs = execFileAsyncStub.mock.calls[0][1] as string[];
    const paramsJson = callArgs[callArgs.indexOf('--params') + 1];
    expect(JSON.parse(paramsJson).format).toBe('metadata');
  });

  it('gmailThreadsGetFull uses format: full', async () => {
    mockExecFile(JSON.stringify({ id: 't1', messages: [{ id: 'm1', labelIds: [] }] }));
    const client = new GwsClient();
    await client.gmailThreadsGetFull('t1');
    const callArgs = execFileAsyncStub.mock.calls[0][1] as string[];
    const paramsJson = callArgs[callArgs.indexOf('--params') + 1];
    expect(JSON.parse(paramsJson).format).toBe('full');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Calendar methods
// ─────────────────────────────────────────────────────────────────────────────

describe('GwsClient Calendar methods', () => {
  let GwsClient: typeof import('../gws-client').GwsClient;

  beforeEach(async () => {
    const mod = await import('../gws-client');
    GwsClient = mod.GwsClient;
  });

  it('calendarAgenda returns validated response', async () => {
    mockExecFile(
      JSON.stringify({
        events: [{ summary: 'Meeting', start: '2026-03-29T09:00:00Z', end: '2026-03-29T10:00:00Z', location: '' }],
        count: 1,
      }),
    );
    const client = new GwsClient();
    const result = await client.calendarAgenda();
    expect(result.events).toHaveLength(1);
    expect(result.events[0].summary).toBe('Meeting');
  });

  it('calendarEventsList includes calendarId: primary', async () => {
    mockExecFile(JSON.stringify({ items: [] }));
    const client = new GwsClient();
    await client.calendarEventsList({ timeMin: '2026-03-29T00:00:00Z' });
    const callArgs = execFileAsyncStub.mock.calls[0][1] as string[];
    const paramsJson = callArgs[callArgs.indexOf('--params') + 1];
    expect(JSON.parse(paramsJson).calendarId).toBe('primary');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Drive methods
// ─────────────────────────────────────────────────────────────────────────────

describe('GwsClient Drive methods', () => {
  let GwsClient: typeof import('../gws-client').GwsClient;

  beforeEach(async () => {
    const mod = await import('../gws-client');
    GwsClient = mod.GwsClient;
  });

  it('driveFilesList passes params including fields', async () => {
    mockExecFile(JSON.stringify({ files: [{ id: 'f1', name: 'Test' }] }));
    const client = new GwsClient();
    const result = await client.driveFilesList({ fields: 'files(id,name)' });
    expect(result.files).toHaveLength(1);
    const callArgs = execFileAsyncStub.mock.calls[0][1] as string[];
    const paramsJson = callArgs[callArgs.indexOf('--params') + 1];
    expect(JSON.parse(paramsJson).fields).toBe('files(id,name)');
  });

  it('driveFilesGet validates response', async () => {
    mockExecFile(
      JSON.stringify({ id: 'f1', name: 'My File', mimeType: 'application/pdf' }),
    );
    const client = new GwsClient();
    const result = await client.driveFilesGet('f1', 'id,name,mimeType');
    expect(result.id).toBe('f1');
    expect(result.name).toBe('My File');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Docs methods
// ─────────────────────────────────────────────────────────────────────────────

describe('GwsClient Docs methods', () => {
  let GwsClient: typeof import('../gws-client').GwsClient;

  beforeEach(async () => {
    const mod = await import('../gws-client');
    GwsClient = mod.GwsClient;
  });

  it('docsDocumentsGet passes documentId and validates response', async () => {
    const docResponse = {
      documentId: 'doc-123',
      title: 'My Document',
      body: { content: [{ endIndex: 1, sectionBreak: { sectionStyle: {} } }] },
      lists: {},
      inlineObjects: {},
    };
    mockExecFile(JSON.stringify(docResponse));
    const client = new GwsClient();
    const result = await client.docsDocumentsGet('doc-123');
    expect(result.documentId).toBe('doc-123');
    expect(result.title).toBe('My Document');
    expect(result.body.content).toHaveLength(1);

    // Verify the CLI args include docs documents get with params
    const callArgs = execFileAsyncStub.mock.calls[0][1] as string[];
    expect(callArgs).toContain('docs');
    expect(callArgs).toContain('documents');
    expect(callArgs).toContain('get');
    const paramsJson = callArgs[callArgs.indexOf('--params') + 1];
    expect(JSON.parse(paramsJson).documentId).toBe('doc-123');
  });

  it('docsDocumentsGet defaults optional fields', async () => {
    const docResponse = {
      documentId: 'doc-456',
      title: 'Minimal Doc',
      body: { content: [] },
    };
    mockExecFile(JSON.stringify(docResponse));
    const client = new GwsClient();
    const result = await client.docsDocumentsGet('doc-456');
    // Optional record fields should default to empty objects
    expect(result.lists).toEqual({});
    expect(result.inlineObjects).toEqual({});
    expect(result.positionedObjects).toEqual({});
    expect(result.headers).toEqual({});
    expect(result.footers).toEqual({});
    expect(result.footnotes).toEqual({});
  });

  it('docsDocumentsGet rejects response missing required fields', async () => {
    // Missing title and body
    mockExecFile(JSON.stringify({ documentId: 'doc-789' }));
    const client = new GwsClient();
    await expect(client.docsDocumentsGet('doc-789')).rejects.toThrow();
  });

  it('docsDocumentsGet passes through extra fields', async () => {
    const docResponse = {
      documentId: 'doc-extra',
      title: 'Extra Fields',
      body: { content: [] },
      revisionId: 'rev-abc',
      suggestionsViewMode: 'PREVIEW_WITHOUT_SUGGESTIONS',
    };
    mockExecFile(JSON.stringify(docResponse));
    const client = new GwsClient();
    const result = await client.docsDocumentsGet('doc-extra');
    // .passthrough() should preserve unknown fields
    expect((result as any).revisionId).toBe('rev-abc');
    expect((result as any).suggestionsViewMode).toBe('PREVIEW_WITHOUT_SUGGESTIONS');
  });
});
