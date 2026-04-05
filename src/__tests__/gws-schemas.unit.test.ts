/**
 * Unit tests for gws CLI Zod schemas.
 *
 * Validates that our schemas correctly parse real-world gws CLI JSON output
 * and reject malformed data where appropriate.
 */

import { describe, it, expect } from 'vitest';
import {
  GwsAuthStatusResponseSchema,
  GmailThreadsListResponseSchema,
  GmailThreadGetResponseSchema,
  GmailMessageSchema,
  CalendarAgendaResponseSchema,
  CalendarEventsListResponseSchema,
  CalendarEventRawSchema,
  DriveFilesListResponseSchema,
  DriveFileRawSchema,
} from '../gws-schemas';

// ─────────────────────────────────────────────────────────────────────────────
// Auth Status
// ─────────────────────────────────────────────────────────────────────────────

describe('GwsAuthStatusResponseSchema', () => {
  it('parses a valid authenticated response', () => {
    const raw = {
      auth_method: 'oauth2',
      token_valid: true,
      user: 'user@gmail.com',
      client_id: '12345.apps.googleusercontent.com',
      project_id: 'my-project',
      storage: 'keyring',
      scope_count: 8,
      scopes: ['https://mail.google.com/', 'https://www.googleapis.com/auth/calendar'],
      has_refresh_token: true,
    };
    const result = GwsAuthStatusResponseSchema.parse(raw);
    expect(result.token_valid).toBe(true);
    expect(result.user).toBe('user@gmail.com');
    expect(result.scopes).toHaveLength(2);
  });

  it('parses a response with expired token', () => {
    const raw = {
      auth_method: 'oauth2',
      token_valid: false,
      user: 'user@gmail.com',
      token_error: 'Token expired',
      has_refresh_token: true,
    };
    const result = GwsAuthStatusResponseSchema.parse(raw);
    expect(result.token_valid).toBe(false);
    expect(result.token_error).toBe('Token expired');
  });

  it('parses a minimal response (just token_valid)', () => {
    const raw = { token_valid: false };
    const result = GwsAuthStatusResponseSchema.parse(raw);
    expect(result.token_valid).toBe(false);
    expect(result.user).toBeUndefined();
  });

  it('passes through unknown fields', () => {
    const raw = { token_valid: true, some_future_field: 'hello' };
    const result = GwsAuthStatusResponseSchema.parse(raw);
    expect((result as any).some_future_field).toBe('hello');
  });

  it('rejects missing token_valid', () => {
    expect(() => GwsAuthStatusResponseSchema.parse({ user: 'x@y.com' })).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gmail Threads List
// ─────────────────────────────────────────────────────────────────────────────

describe('GmailThreadsListResponseSchema', () => {
  it('parses a response with threads', () => {
    const raw = {
      threads: [
        { id: '18f1234abc', historyId: '999', snippet: 'Hey there...' },
        { id: '18f5678def', snippet: 'Meeting tomorrow' },
      ],
      resultSizeEstimate: 2,
    };
    const result = GmailThreadsListResponseSchema.parse(raw);
    expect(result.threads).toHaveLength(2);
    expect(result.threads[0].id).toBe('18f1234abc');
    expect(result.threads[1].historyId).toBeUndefined();
  });

  it('defaults threads to empty array when missing', () => {
    const raw = { resultSizeEstimate: 0 };
    const result = GmailThreadsListResponseSchema.parse(raw);
    expect(result.threads).toEqual([]);
  });

  it('defaults threads to empty array when null', () => {
    const raw = { threads: null };
    // null is not assignable to array, but the optional().default([]) should handle undefined
    // null should actually fail — testing the boundary
    expect(() => GmailThreadsListResponseSchema.parse(raw)).toThrow();
  });

  it('parses with nextPageToken', () => {
    const raw = {
      threads: [{ id: 'abc' }],
      nextPageToken: 'token123',
      resultSizeEstimate: 100,
    };
    const result = GmailThreadsListResponseSchema.parse(raw);
    expect(result.nextPageToken).toBe('token123');
  });

  it('rejects thread without id', () => {
    const raw = { threads: [{ snippet: 'no id' }] };
    expect(() => GmailThreadsListResponseSchema.parse(raw)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gmail Thread Get (with messages)
// ─────────────────────────────────────────────────────────────────────────────

describe('GmailThreadGetResponseSchema', () => {
  it('parses a thread with messages', () => {
    const raw = {
      id: '18f1234abc',
      historyId: '12345',
      messages: [
        {
          id: 'msg1',
          threadId: '18f1234abc',
          labelIds: ['INBOX', 'UNREAD'],
          snippet: 'Hello world',
          payload: {
            mimeType: 'text/plain',
            headers: [
              { name: 'Subject', value: 'Test email' },
              { name: 'From', value: 'sender@example.com' },
              { name: 'To', value: 'me@example.com' },
              { name: 'Date', value: 'Sat, 29 Mar 2026 10:00:00 -0400' },
            ],
            body: { size: 11, data: 'SGVsbG8gV29ybGQ' },
          },
        },
      ],
    };
    const result = GmailThreadGetResponseSchema.parse(raw);
    expect(result.id).toBe('18f1234abc');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].labelIds).toContain('UNREAD');
    expect(result.messages[0].payload?.headers).toHaveLength(4);
  });

  it('defaults messages to empty array when missing', () => {
    const raw = { id: 'thread1' };
    const result = GmailThreadGetResponseSchema.parse(raw);
    expect(result.messages).toEqual([]);
  });

  it('parses a multipart/alternative message', () => {
    const raw = {
      id: 'thread2',
      messages: [
        {
          id: 'msg2',
          payload: {
            mimeType: 'multipart/alternative',
            headers: [{ name: 'Subject', value: 'Multi' }],
            parts: [
              {
                partId: '0',
                mimeType: 'text/plain',
                body: { size: 5, data: 'SGVsbG8' },
              },
              {
                partId: '1',
                mimeType: 'text/html',
                body: { size: 20, data: 'PGI-SGVsbG88L2I-' },
              },
            ],
          },
        },
      ],
    };
    const result = GmailThreadGetResponseSchema.parse(raw);
    const parts = result.messages[0].payload?.parts;
    expect(parts).toHaveLength(2);
    expect(parts![0].mimeType).toBe('text/plain');
    expect(parts![1].mimeType).toBe('text/html');
  });

  it('parses deeply nested multipart/mixed message', () => {
    const raw = {
      id: 'thread3',
      messages: [
        {
          id: 'msg3',
          payload: {
            mimeType: 'multipart/mixed',
            headers: [],
            parts: [
              {
                partId: '0',
                mimeType: 'multipart/alternative',
                parts: [
                  {
                    partId: '0.0',
                    mimeType: 'text/plain',
                    body: { data: 'dGV4dA' },
                  },
                  {
                    partId: '0.1',
                    mimeType: 'text/html',
                    body: { data: 'PHA-aHRtbDwvcD4' },
                  },
                ],
              },
              {
                partId: '1',
                mimeType: 'application/pdf',
                filename: 'doc.pdf',
                body: { attachmentId: 'att123', size: 1024 },
              },
            ],
          },
        },
      ],
    };
    const result = GmailThreadGetResponseSchema.parse(raw);
    const topParts = result.messages[0].payload?.parts;
    expect(topParts).toHaveLength(2);
    expect(topParts![0].parts).toHaveLength(2);
    expect(topParts![1].filename).toBe('doc.pdf');
  });

  it('rejects thread without id', () => {
    expect(() => GmailThreadGetResponseSchema.parse({ messages: [] })).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gmail Message
// ─────────────────────────────────────────────────────────────────────────────

describe('GmailMessageSchema', () => {
  it('parses a full message with all fields', () => {
    const raw = {
      id: 'msg1',
      threadId: 'thread1',
      historyId: '99999',
      internalDate: '1711700400000',
      labelIds: ['INBOX', 'IMPORTANT'],
      snippet: 'Preview text...',
      sizeEstimate: 5000,
      payload: {
        mimeType: 'text/plain',
        headers: [{ name: 'Subject', value: 'Hello' }],
        body: { size: 5, data: 'SGVsbG8' },
      },
    };
    const result = GmailMessageSchema.parse(raw);
    expect(result.id).toBe('msg1');
    expect(result.threadId).toBe('thread1');
    expect(result.labelIds).toContain('IMPORTANT');
    expect(result.payload?.body?.data).toBe('SGVsbG8');
  });

  it('defaults labelIds to empty array', () => {
    const raw = { id: 'msg2' };
    const result = GmailMessageSchema.parse(raw);
    expect(result.labelIds).toEqual([]);
  });

  it('rejects message without id', () => {
    expect(() => GmailMessageSchema.parse({ threadId: 't1' })).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Calendar Agenda
// ─────────────────────────────────────────────────────────────────────────────

describe('CalendarAgendaResponseSchema', () => {
  it('parses a response with events', () => {
    const raw = {
      events: [
        {
          summary: 'Team Standup',
          start: '2026-03-29T09:00:00-04:00',
          end: '2026-03-29T09:30:00-04:00',
          location: 'Conference Room A',
          calendar: 'Work',
        },
        {
          summary: 'Lunch',
          start: '2026-03-29T12:00:00-04:00',
          end: '2026-03-29T13:00:00-04:00',
          location: '',
        },
      ],
      count: 2,
      timeMin: '2026-03-29T00:00:00-04:00',
      timeMax: '2026-03-30T00:00:00-04:00',
    };
    const result = CalendarAgendaResponseSchema.parse(raw);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].summary).toBe('Team Standup');
    expect(result.events[0].calendar).toBe('Work');
    expect(result.events[1].location).toBe('');
    expect(result.count).toBe(2);
  });

  it('defaults events to empty array when missing', () => {
    const raw = { count: 0 };
    const result = CalendarAgendaResponseSchema.parse(raw);
    expect(result.events).toEqual([]);
  });

  it('rejects agenda event without start', () => {
    const raw = {
      events: [{ summary: 'No times', end: '2026-03-29T10:00:00Z' }],
    };
    expect(() => CalendarAgendaResponseSchema.parse(raw)).toThrow();
  });

  it('rejects agenda event without end', () => {
    const raw = {
      events: [{ summary: 'No end', start: '2026-03-29T09:00:00Z' }],
    };
    expect(() => CalendarAgendaResponseSchema.parse(raw)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Calendar Events List
// ─────────────────────────────────────────────────────────────────────────────

describe('CalendarEventsListResponseSchema', () => {
  it('parses a response with items', () => {
    const raw = {
      items: [
        {
          id: 'evt1',
          summary: 'Team Meeting',
          start: { dateTime: '2026-03-29T14:00:00-04:00', timeZone: 'America/New_York' },
          end: { dateTime: '2026-03-29T15:00:00-04:00', timeZone: 'America/New_York' },
          status: 'confirmed',
          htmlLink: 'https://calendar.google.com/event?eid=evt1',
          attendees: [
            { email: 'alice@example.com', displayName: 'Alice', responseStatus: 'accepted' },
            { email: 'bob@example.com', responseStatus: 'needsAction', self: true },
          ],
          organizer: { email: 'alice@example.com', displayName: 'Alice' },
        },
      ],
      summary: 'primary',
      timeZone: 'America/New_York',
    };
    const result = CalendarEventsListResponseSchema.parse(raw);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].attendees).toHaveLength(2);
    expect(result.items[0].organizer?.displayName).toBe('Alice');
  });

  it('defaults items to empty array', () => {
    const raw = { summary: 'primary' };
    const result = CalendarEventsListResponseSchema.parse(raw);
    expect(result.items).toEqual([]);
  });

  it('passes through unknown fields', () => {
    const raw = { items: [], futureField: true };
    const result = CalendarEventsListResponseSchema.parse(raw);
    expect((result as any).futureField).toBe(true);
  });
});

describe('CalendarEventRawSchema', () => {
  it('parses an all-day event', () => {
    const raw = {
      id: 'evt_allday',
      summary: 'Company Holiday',
      start: { date: '2026-04-01' },
      end: { date: '2026-04-02' },
      status: 'confirmed',
      eventType: 'default',
    };
    const result = CalendarEventRawSchema.parse(raw);
    expect(result.start?.date).toBe('2026-04-01');
    expect(result.start?.dateTime).toBeUndefined();
  });

  it('parses an event with hangout link', () => {
    const raw = {
      id: 'evt_meet',
      summary: 'Video Call',
      start: { dateTime: '2026-03-29T16:00:00Z' },
      end: { dateTime: '2026-03-29T17:00:00Z' },
      hangoutLink: 'https://meet.google.com/abc-def-ghi',
    };
    const result = CalendarEventRawSchema.parse(raw);
    expect(result.hangoutLink).toBe('https://meet.google.com/abc-def-ghi');
  });

  it('parses recurring event instance', () => {
    const raw = {
      id: 'evt_recur_20260329',
      summary: 'Daily Standup',
      start: { dateTime: '2026-03-29T09:00:00-04:00' },
      end: { dateTime: '2026-03-29T09:15:00-04:00' },
      recurringEventId: 'evt_recur',
    };
    const result = CalendarEventRawSchema.parse(raw);
    expect(result.recurringEventId).toBe('evt_recur');
  });

  it('rejects event without id', () => {
    expect(() => CalendarEventRawSchema.parse({ summary: 'No ID' })).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Drive Files
// ─────────────────────────────────────────────────────────────────────────────

describe('DriveFilesListResponseSchema', () => {
  it('parses a response with files', () => {
    const raw = {
      files: [
        {
          id: 'file1',
          name: 'Budget 2026.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          modifiedTime: '2026-03-28T15:30:00.000Z',
          size: '52428',
          owners: [
            { displayName: 'Alice Smith', emailAddress: 'alice@example.com', me: true },
          ],
          webViewLink: 'https://docs.google.com/spreadsheets/d/file1/edit',
          starred: false,
          shared: true,
        },
        {
          id: 'file2',
          name: 'Project Notes',
          mimeType: 'application/vnd.google-apps.document',
          modifiedTime: '2026-03-27T10:00:00.000Z',
          webViewLink: 'https://docs.google.com/document/d/file2/edit',
        },
      ],
      incompleteSearch: false,
    };
    const result = DriveFilesListResponseSchema.parse(raw);
    expect(result.files).toHaveLength(2);
    expect(result.files[0].owners?.[0].displayName).toBe('Alice Smith');
    expect(result.files[1].size).toBeUndefined();
  });

  it('defaults files to empty array', () => {
    const raw = {};
    const result = DriveFilesListResponseSchema.parse(raw);
    expect(result.files).toEqual([]);
  });

  it('parses with nextPageToken', () => {
    const raw = { files: [], nextPageToken: 'page2' };
    const result = DriveFilesListResponseSchema.parse(raw);
    expect(result.nextPageToken).toBe('page2');
  });
});

describe('DriveFileRawSchema', () => {
  it('parses a Google Doc', () => {
    const raw = {
      id: 'gdoc1',
      name: 'Meeting Notes',
      mimeType: 'application/vnd.google-apps.document',
      createdTime: '2026-01-15T09:00:00.000Z',
      modifiedTime: '2026-03-29T08:00:00.000Z',
      webViewLink: 'https://docs.google.com/document/d/gdoc1/edit',
      starred: true,
      shared: false,
      parents: ['folder1'],
    };
    const result = DriveFileRawSchema.parse(raw);
    expect(result.name).toBe('Meeting Notes');
    expect(result.starred).toBe(true);
    expect(result.parents).toEqual(['folder1']);
  });

  it('parses a file with minimal fields', () => {
    const raw = { id: 'min1' };
    const result = DriveFileRawSchema.parse(raw);
    expect(result.id).toBe('min1');
    expect(result.name).toBeUndefined();
    expect(result.mimeType).toBeUndefined();
  });

  it('passes through unknown fields', () => {
    const raw = { id: 'pt1', thumbnailLink: 'https://...' };
    const result = DriveFileRawSchema.parse(raw);
    expect((result as any).thumbnailLink).toBe('https://...');
  });

  it('rejects file without id', () => {
    expect(() => DriveFileRawSchema.parse({ name: 'No ID' })).toThrow();
  });
});
