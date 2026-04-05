/**
 * Integration tests for API layer — tests api.ts functions with a mocked GwsClient.
 *
 * These tests verify the full pipeline: client method → shape conversion → return value.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphQLError } from 'graphql';
import {
  checkAuthStatus,
  listThreads,
  getThread,
  getMessage,
  sendEmail,
  getAgenda,
  listEvents,
  getEvent,
  createEvent,
  listFiles,
  getFile,
} from '../api';
import { GwsError, GwsExitCode } from '../gws-client';
import type { GwsClient } from '../gws-client';

/** Create a mock GwsClient with vi.fn() stubs for all methods. */
function createMockClient(): GwsClient {
  return {
    exec: vi.fn(),
    isAuthenticated: vi.fn(),
    authStatus: vi.fn(),
    gmailThreadsList: vi.fn(),
    gmailThreadsGetMetadata: vi.fn(),
    gmailThreadsGetFull: vi.fn(),
    gmailMessagesGet: vi.fn(),
    gmailSend: vi.fn(),
    calendarAgenda: vi.fn(),
    calendarEventsList: vi.fn(),
    calendarEventsGet: vi.fn(),
    calendarInsertEvent: vi.fn(),
    driveFilesList: vi.fn(),
    driveFilesGet: vi.fn(),
  } as unknown as GwsClient;
}

let client: ReturnType<typeof createMockClient>;

beforeEach(() => {
  client = createMockClient();
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

describe('checkAuthStatus', () => {
  it('returns authenticated status with email', async () => {
    (client.authStatus as any).mockResolvedValue({
      token_valid: true,
      user: 'me@gmail.com',
    });
    const result = await checkAuthStatus(client);
    expect(result).toEqual({
      authenticated: true,
      email: 'me@gmail.com',
      tokenError: undefined,
    });
  });

  it('returns unauthenticated with token error', async () => {
    (client.authStatus as any).mockResolvedValue({
      token_valid: false,
      user: 'me@gmail.com',
      token_error: 'Token has been expired or revoked.',
    });
    const result = await checkAuthStatus(client);
    expect(result).toEqual({
      authenticated: false,
      email: 'me@gmail.com',
      tokenError: 'Token has been expired or revoked.',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gmail
// ─────────────────────────────────────────────────────────────────────────────

describe('listThreads', () => {
  it('fetches metadata for each thread stub', async () => {
    (client.gmailThreadsList as any).mockResolvedValue({
      threads: [
        { id: 't1', snippet: 'Hello' },
        { id: 't2', snippet: 'World' },
      ],
    });
    (client.gmailThreadsGetMetadata as any)
      .mockResolvedValueOnce({
        id: 't1',
        messages: [
          {
            id: 'm1',
            threadId: 't1',
            labelIds: ['INBOX', 'UNREAD'],
            payload: {
              headers: [
                { name: 'Subject', value: 'First Thread' },
                { name: 'From', value: 'alice@example.com' },
                { name: 'Date', value: 'Sat, 29 Mar 2026' },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 't2',
        messages: [
          {
            id: 'm2',
            threadId: 't2',
            labelIds: ['INBOX'],
            payload: {
              headers: [
                { name: 'Subject', value: 'Second Thread' },
                { name: 'From', value: 'bob@example.com' },
              ],
            },
          },
        ],
      });

    const result = await listThreads(client, { maxResults: 10 });
    expect(result).toHaveLength(2);
    expect(result[0].subject).toBe('First Thread');
    expect(result[0].unread).toBe(true);
    expect(result[1].subject).toBe('Second Thread');
    expect(result[1].unread).toBe(false);
  });

  it('returns empty array when no threads', async () => {
    (client.gmailThreadsList as any).mockResolvedValue({ threads: [] });
    const result = await listThreads(client, {});
    expect(result).toEqual([]);
  });

  it('falls back to stub data if metadata fetch fails', async () => {
    (client.gmailThreadsList as any).mockResolvedValue({
      threads: [{ id: 't1', snippet: 'Fallback snippet' }],
    });
    (client.gmailThreadsGetMetadata as any).mockRejectedValue(new Error('timeout'));
    const result = await listThreads(client, {});
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
    expect(result[0].snippet).toBe('Fallback snippet');
    expect(result[0].subject).toBeUndefined();
  });

  it('wraps GwsError as GraphQLError', async () => {
    (client.gmailThreadsList as any).mockRejectedValue(
      new GwsError('API failed', GwsExitCode.API_ERROR, 'quota exceeded'),
    );
    await expect(listThreads(client, {})).rejects.toThrow(GraphQLError);
  });
});

describe('getThread', () => {
  it('returns thread with message bodies', async () => {
    (client.gmailThreadsGetFull as any).mockResolvedValue({
      id: 't1',
      messages: [
        {
          id: 'm1',
          threadId: 't1',
          labelIds: ['INBOX'],
          snippet: 'Hey',
          payload: {
            mimeType: 'text/plain',
            headers: [{ name: 'Subject', value: 'Hello' }],
            body: { data: Buffer.from('Hello body').toString('base64url') },
          },
        },
      ],
    });
    const result = await getThread(client, { threadId: 't1' });
    expect(result).not.toBeNull();
    expect(result!.messages).toHaveLength(1);
    expect(result!.messages![0].body).toBe('Hello body');
  });
});

describe('getMessage', () => {
  it('returns shaped message', async () => {
    (client.gmailMessagesGet as any).mockResolvedValue({
      id: 'm1',
      threadId: 't1',
      labelIds: ['INBOX'],
      payload: {
        headers: [{ name: 'Subject', value: 'Test' }],
        mimeType: 'text/plain',
        body: { data: Buffer.from('body text').toString('base64url') },
      },
    });
    const result = await getMessage(client, { messageId: 'm1' });
    expect(result!.subject).toBe('Test');
    expect(result!.body).toBe('body text');
  });
});

describe('sendEmail', () => {
  it('returns success', async () => {
    (client.gmailSend as any).mockResolvedValue({});
    const result = await sendEmail(client, { to: 'a@b.com', subject: 'Hi', body: 'Hey' });
    expect(result.success).toBe(true);
  });

  it('wraps errors', async () => {
    (client.gmailSend as any).mockRejectedValue(
      new GwsError('send failed', GwsExitCode.API_ERROR, 'err'),
    );
    await expect(sendEmail(client, { to: 'a@b.com', subject: 'Hi', body: 'Hey' })).rejects.toThrow(
      GraphQLError,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Calendar
// ─────────────────────────────────────────────────────────────────────────────

describe('getAgenda', () => {
  it('returns shaped agenda events', async () => {
    (client.calendarAgenda as any).mockResolvedValue({
      events: [
        { summary: 'Standup', start: '2026-03-29T09:00:00Z', end: '2026-03-29T09:30:00Z', location: '' },
        { summary: 'Lunch', start: '2026-03-29T12:00:00Z', end: '2026-03-29T13:00:00Z', location: '' },
      ],
      count: 2,
    });
    const result = await getAgenda(client);
    expect(result).toHaveLength(2);
    expect(result[0].summary).toBe('Standup');
    expect(result[0].allDay).toBe(false);
  });

  it('returns empty array for no events', async () => {
    (client.calendarAgenda as any).mockResolvedValue({ events: [], count: 0 });
    const result = await getAgenda(client);
    expect(result).toEqual([]);
  });
});

describe('listEvents', () => {
  it('returns shaped calendar events', async () => {
    (client.calendarEventsList as any).mockResolvedValue({
      items: [
        {
          id: 'evt1',
          summary: 'Sprint Review',
          start: { dateTime: '2026-03-30T14:00:00Z' },
          end: { dateTime: '2026-03-30T15:00:00Z' },
          status: 'confirmed',
        },
      ],
    });
    const result = await listEvents(client, { timeMin: '2026-03-30T00:00:00Z' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('evt1');
    expect(result[0].summary).toBe('Sprint Review');
    expect(result[0].allDay).toBe(false);
  });

  it('passes query and maxResults params', async () => {
    (client.calendarEventsList as any).mockResolvedValue({ items: [] });
    await listEvents(client, { query: 'standup', maxResults: 5 });
    const params = (client.calendarEventsList as any).mock.calls[0][0];
    expect(params.q).toBe('standup');
    expect(params.maxResults).toBe(5);
    expect(params.singleEvents).toBe(true);
    expect(params.orderBy).toBe('startTime');
  });
});

describe('getEvent', () => {
  it('returns shaped event', async () => {
    (client.calendarEventsGet as any).mockResolvedValue({
      id: 'evt1',
      summary: 'Meeting',
      start: { dateTime: '2026-03-30T10:00:00Z' },
      end: { dateTime: '2026-03-30T11:00:00Z' },
      attendees: [{ email: 'alice@example.com', responseStatus: 'accepted' }],
    });
    const result = await getEvent(client, { eventId: 'evt1' });
    expect(result!.attendees).toHaveLength(1);
  });
});

describe('createEvent', () => {
  it('returns success', async () => {
    (client.calendarInsertEvent as any).mockResolvedValue({});
    const result = await createEvent(client, {
      summary: 'New Event',
      start: '2026-04-01T10:00:00Z',
      end: '2026-04-01T11:00:00Z',
    });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Drive
// ─────────────────────────────────────────────────────────────────────────────

describe('listFiles', () => {
  it('returns shaped files', async () => {
    (client.driveFilesList as any).mockResolvedValue({
      files: [
        {
          id: 'f1',
          name: 'Budget.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          modifiedTime: '2026-03-28T15:30:00Z',
          owners: [{ displayName: 'Alice', emailAddress: 'alice@example.com' }],
          webViewLink: 'https://docs.google.com/spreadsheets/d/f1/edit',
        },
      ],
    });
    const result = await listFiles(client, {});
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Budget.xlsx');
    expect(result[0].mimeTypeLabel).toBe('Excel');
    expect(result[0].ownerName).toBe('Alice');
  });

  it('includes fields in params', async () => {
    (client.driveFilesList as any).mockResolvedValue({ files: [] });
    await listFiles(client, { query: 'name contains "report"', pageSize: 20 });
    const params = (client.driveFilesList as any).mock.calls[0][0];
    expect(params.fields).toBeDefined();
    expect(params.q).toBe('name contains "report"');
    expect(params.pageSize).toBe(20);
  });

  it('adds orderBy when no query', async () => {
    (client.driveFilesList as any).mockResolvedValue({ files: [] });
    await listFiles(client, {});
    const params = (client.driveFilesList as any).mock.calls[0][0];
    expect(params.orderBy).toBe('modifiedTime desc');
  });

  it('omits orderBy when query is provided', async () => {
    (client.driveFilesList as any).mockResolvedValue({ files: [] });
    await listFiles(client, { query: 'test' });
    const params = (client.driveFilesList as any).mock.calls[0][0];
    expect(params.orderBy).toBeUndefined();
  });
});

describe('getFile', () => {
  it('returns shaped file', async () => {
    (client.driveFilesGet as any).mockResolvedValue({
      id: 'f1',
      name: 'Notes',
      mimeType: 'application/vnd.google-apps.document',
      starred: true,
      shared: false,
    });
    const result = await getFile(client, { fileId: 'f1' });
    expect(result!.mimeTypeLabel).toBe('Google Doc');
    expect(result!.starred).toBe(true);
  });

  it('wraps errors', async () => {
    (client.driveFilesGet as any).mockRejectedValue(
      new GwsError('Not found', GwsExitCode.API_ERROR, '404'),
    );
    await expect(getFile(client, { fileId: 'bad' })).rejects.toThrow(GraphQLError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error wrapping
// ─────────────────────────────────────────────────────────────────────────────

describe('error wrapping', () => {
  it('re-throws GraphQLError as-is', async () => {
    const gqlError = new GraphQLError('Already a GQL error');
    (client.gmailThreadsList as any).mockRejectedValue(gqlError);
    await expect(listThreads(client, {})).rejects.toBe(gqlError);
  });

  it('wraps GwsError with context and exit code', async () => {
    (client.calendarAgenda as any).mockRejectedValue(
      new GwsError('API rate limit', GwsExitCode.API_ERROR, 'rate limit stderr'),
    );
    try {
      await getAgenda(client);
      expect.fail('Should throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(GraphQLError);
      expect(err.message).toContain('API rate limit');
      expect(err.extensions.code).toBe('GWS_ERROR');
      expect(err.extensions.exitCode).toBe(1);
      expect(err.extensions.context).toBe('getAgenda');
    }
  });

  it('re-throws unknown errors as-is', async () => {
    const weird = new TypeError('something unexpected');
    (client.driveFilesList as any).mockRejectedValue(weird);
    await expect(listFiles(client, {})).rejects.toBe(weird);
  });
});
