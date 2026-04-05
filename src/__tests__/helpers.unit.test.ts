/**
 * Unit tests for helper functions — shape converters, header extraction, body parsing.
 */

import { describe, it, expect } from 'vitest';
import {
  getHeader,
  getMessageBody,
  rawThreadToShape,
  rawMessageToShape,
  rawAgendaEventToShape,
  rawEventToShape,
  rawFileToShape,
  getMimeTypeLabel,
  formatRelative,
} from '../helpers';
import type {
  GmailThreadGetResponse,
  GmailMessage,
  CalendarAgendaEvent,
  CalendarEventRaw,
  DriveFileRaw,
} from '../gws-schemas';

// ─────────────────────────────────────────────────────────────────────────────
// getHeader
// ─────────────────────────────────────────────────────────────────────────────

describe('getHeader', () => {
  const headers = [
    { name: 'Subject', value: 'Hello World' },
    { name: 'From', value: 'alice@example.com' },
    { name: 'To', value: 'bob@example.com' },
    { name: 'Date', value: 'Sat, 29 Mar 2026 10:00:00 -0400' },
    { name: 'Content-Type', value: 'text/plain; charset=utf-8' },
  ];

  it('finds a header by exact name', () => {
    expect(getHeader(headers, 'Subject')).toBe('Hello World');
  });

  it('is case-insensitive', () => {
    expect(getHeader(headers, 'subject')).toBe('Hello World');
    expect(getHeader(headers, 'FROM')).toBe('alice@example.com');
    expect(getHeader(headers, 'content-type')).toBe('text/plain; charset=utf-8');
  });

  it('returns undefined for missing header', () => {
    expect(getHeader(headers, 'Cc')).toBeUndefined();
  });

  it('returns undefined for undefined headers array', () => {
    expect(getHeader(undefined, 'Subject')).toBeUndefined();
  });

  it('returns undefined for empty headers array', () => {
    expect(getHeader([], 'Subject')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getMessageBody
// ─────────────────────────────────────────────────────────────────────────────

describe('getMessageBody', () => {
  it('returns empty for undefined payload', () => {
    expect(getMessageBody(undefined)).toEqual({});
  });

  it('decodes a simple text/plain body', () => {
    const payload = {
      mimeType: 'text/plain',
      body: { data: Buffer.from('Hello World').toString('base64url') },
    };
    const result = getMessageBody(payload);
    expect(result.text).toBe('Hello World');
    expect(result.html).toBeUndefined();
  });

  it('decodes a simple text/html body', () => {
    const html = '<b>Hello</b>';
    const payload = {
      mimeType: 'text/html',
      body: { data: Buffer.from(html).toString('base64url') },
    };
    const result = getMessageBody(payload);
    expect(result.html).toBe(html);
    expect(result.text).toBeUndefined();
  });

  it('extracts text and html from multipart/alternative', () => {
    const payload = {
      mimeType: 'multipart/alternative',
      parts: [
        {
          partId: '0',
          mimeType: 'text/plain',
          body: { data: Buffer.from('Plain text').toString('base64url') },
        },
        {
          partId: '1',
          mimeType: 'text/html',
          body: { data: Buffer.from('<p>HTML text</p>').toString('base64url') },
        },
      ],
    };
    const result = getMessageBody(payload);
    expect(result.text).toBe('Plain text');
    expect(result.html).toBe('<p>HTML text</p>');
  });

  it('extracts from multipart/mixed with nested multipart/alternative', () => {
    const payload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          partId: '0',
          mimeType: 'multipart/alternative',
          parts: [
            {
              partId: '0.0',
              mimeType: 'text/plain',
              body: { data: Buffer.from('Nested plain').toString('base64url') },
            },
            {
              partId: '0.1',
              mimeType: 'text/html',
              body: { data: Buffer.from('<em>Nested HTML</em>').toString('base64url') },
            },
          ],
        },
        {
          partId: '1',
          mimeType: 'application/pdf',
          filename: 'doc.pdf',
          body: { attachmentId: 'att1', size: 1024 },
        },
      ],
    };
    const result = getMessageBody(payload);
    expect(result.text).toBe('Nested plain');
    expect(result.html).toBe('<em>Nested HTML</em>');
  });

  it('returns first text/plain found (does not overwrite)', () => {
    const payload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'text/plain',
          body: { data: Buffer.from('First').toString('base64url') },
        },
        {
          mimeType: 'text/plain',
          body: { data: Buffer.from('Second').toString('base64url') },
        },
      ],
    };
    const result = getMessageBody(payload);
    expect(result.text).toBe('First');
  });

  it('handles payload with empty body (no data)', () => {
    const payload = {
      mimeType: 'text/plain',
      body: { size: 0 },
    };
    const result = getMessageBody(payload);
    expect(result).toEqual({});
  });

  it('handles multipart with no matching text parts', () => {
    const payload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'image/png',
          body: { attachmentId: 'img1' },
        },
      ],
    };
    const result = getMessageBody(payload);
    expect(result.text).toBeUndefined();
    expect(result.html).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// rawThreadToShape
// ─────────────────────────────────────────────────────────────────────────────

describe('rawThreadToShape', () => {
  it('converts a thread stub (from threads.list) with no messages', () => {
    const stub = { id: 'thread1', snippet: 'Preview...', historyId: '100' };
    const shape = rawThreadToShape(stub);
    expect(shape.id).toBe('thread1');
    expect(shape.snippet).toBe('Preview...');
    expect(shape.historyId).toBe('100');
    expect(shape.subject).toBeUndefined();
    expect(shape.from).toBeUndefined();
    expect(shape.messageCount).toBeUndefined();
    expect(shape.messages).toBeUndefined();
    expect(shape.unread).toBe(false);
  });

  it('converts a full thread (from threads.get) with messages', () => {
    const raw: GmailThreadGetResponse = {
      id: 'thread2',
      historyId: '200',
      messages: [
        {
          id: 'msg1',
          threadId: 'thread2',
          labelIds: ['INBOX', 'UNREAD'],
          snippet: 'First message',
          payload: {
            headers: [
              { name: 'Subject', value: 'Project Update' },
              { name: 'From', value: 'Alice <alice@example.com>' },
              { name: 'To', value: 'bob@example.com' },
              { name: 'Date', value: 'Sat, 29 Mar 2026 10:00:00 -0400' },
            ],
          },
        },
        {
          id: 'msg2',
          threadId: 'thread2',
          labelIds: ['INBOX'],
          snippet: 'Reply',
          payload: {
            headers: [
              { name: 'Subject', value: 'Re: Project Update' },
              { name: 'From', value: 'bob@example.com' },
            ],
          },
        },
      ],
    };
    const shape = rawThreadToShape(raw);
    expect(shape.id).toBe('thread2');
    expect(shape.subject).toBe('Project Update');
    expect(shape.from).toBe('Alice <alice@example.com>');
    expect(shape.to).toBe('bob@example.com');
    expect(shape.date).toBe('Sat, 29 Mar 2026 10:00:00 -0400');
    expect(shape.unread).toBe(true);
    expect(shape.messageCount).toBe(2);
    expect(shape.messages).toHaveLength(2);
    expect(shape.labelIds).toContain('UNREAD');
  });

  it('falls back to snippet from first message when thread has no snippet', () => {
    const raw: GmailThreadGetResponse = {
      id: 'thread3',
      messages: [
        {
          id: 'msg1',
          snippet: 'Message snippet',
          labelIds: [],
          payload: { headers: [] },
        },
      ],
    };
    const shape = rawThreadToShape(raw);
    expect(shape.snippet).toBe('Message snippet');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// rawMessageToShape
// ─────────────────────────────────────────────────────────────────────────────

describe('rawMessageToShape', () => {
  it('converts a message with headers and body', () => {
    const raw: GmailMessage = {
      id: 'msg1',
      threadId: 'thread1',
      labelIds: ['INBOX', 'IMPORTANT'],
      snippet: 'Hello there',
      payload: {
        mimeType: 'multipart/alternative',
        headers: [
          { name: 'Subject', value: 'Greetings' },
          { name: 'From', value: 'sender@test.com' },
          { name: 'To', value: 'me@test.com' },
          { name: 'Date', value: 'Sun, 30 Mar 2026 08:00:00 +0000' },
        ],
        parts: [
          {
            mimeType: 'text/plain',
            body: { data: Buffer.from('Hello there plain').toString('base64url') },
          },
          {
            mimeType: 'text/html',
            body: { data: Buffer.from('<p>Hello there HTML</p>').toString('base64url') },
          },
        ],
      },
    };
    const shape = rawMessageToShape(raw);
    expect(shape.id).toBe('msg1');
    expect(shape.threadId).toBe('thread1');
    expect(shape.subject).toBe('Greetings');
    expect(shape.from).toBe('sender@test.com');
    expect(shape.body).toBe('Hello there plain');
    expect(shape.bodyHtml).toBe('<p>Hello there HTML</p>');
    expect(shape.labelIds).toContain('IMPORTANT');
  });

  it('handles message with no payload', () => {
    const raw: GmailMessage = {
      id: 'msg2',
      labelIds: [],
    };
    const shape = rawMessageToShape(raw);
    expect(shape.id).toBe('msg2');
    expect(shape.threadId).toBe('');
    expect(shape.subject).toBeUndefined();
    expect(shape.body).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// rawAgendaEventToShape
// ─────────────────────────────────────────────────────────────────────────────

describe('rawAgendaEventToShape', () => {
  it('converts an agenda event with all fields', () => {
    const raw: CalendarAgendaEvent = {
      summary: 'Team Standup',
      start: '2026-03-29T09:00:00-04:00',
      end: '2026-03-29T09:30:00-04:00',
      location: 'Room 101',
      calendar: 'Work',
    };
    const shape = rawAgendaEventToShape(raw);
    expect(shape.id).toBe('Team Standup_2026-03-29T09:00:00-04:00');
    expect(shape.summary).toBe('Team Standup');
    expect(shape.start).toBe('2026-03-29T09:00:00-04:00');
    expect(shape.end).toBe('2026-03-29T09:30:00-04:00');
    expect(shape.location).toBe('Room 101');
    expect(shape.organizer).toBe('Work');
    expect(shape.allDay).toBe(false);
    expect(shape.startFormatted).toBeDefined();
  });

  it('converts an agenda event with empty location to undefined', () => {
    const raw: CalendarAgendaEvent = {
      summary: 'Lunch',
      start: '2026-03-29T12:00:00Z',
      end: '2026-03-29T13:00:00Z',
      location: '',
    };
    const shape = rawAgendaEventToShape(raw);
    expect(shape.location).toBeUndefined();
  });

  it('synthesizes id from empty summary', () => {
    const raw: CalendarAgendaEvent = {
      start: '2026-03-29T14:00:00Z',
      end: '2026-03-29T15:00:00Z',
      location: '',
    };
    const shape = rawAgendaEventToShape(raw);
    expect(shape.id).toBe('_2026-03-29T14:00:00Z');
    expect(shape.summary).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// rawEventToShape
// ─────────────────────────────────────────────────────────────────────────────

describe('rawEventToShape', () => {
  it('converts a timed event', () => {
    const raw: CalendarEventRaw = {
      id: 'evt1',
      summary: 'Sprint Planning',
      description: 'Plan the next sprint',
      location: 'Board Room',
      start: { dateTime: '2026-03-30T10:00:00-04:00', timeZone: 'America/New_York' },
      end: { dateTime: '2026-03-30T11:00:00-04:00', timeZone: 'America/New_York' },
      status: 'confirmed',
      htmlLink: 'https://calendar.google.com/event?eid=evt1',
      hangoutLink: 'https://meet.google.com/abc-def',
      attendees: [
        { email: 'alice@example.com', displayName: 'Alice', responseStatus: 'accepted' },
        { email: 'bob@example.com', responseStatus: 'tentative', self: true },
      ],
      organizer: { email: 'alice@example.com', displayName: 'Alice' },
      created: '2026-03-25T08:00:00Z',
      updated: '2026-03-28T12:00:00Z',
    };
    const shape = rawEventToShape(raw);
    expect(shape.id).toBe('evt1');
    expect(shape.summary).toBe('Sprint Planning');
    expect(shape.allDay).toBe(false);
    expect(shape.start).toBe('2026-03-30T10:00:00-04:00');
    expect(shape.hangoutLink).toBe('https://meet.google.com/abc-def');
    expect(shape.attendees).toHaveLength(2);
    expect(shape.attendees![0].displayName).toBe('Alice');
    expect(shape.attendees![1].self).toBe(true);
    expect(shape.attendeeNames).toBe('Alice, bob@example.com');
    expect(shape.organizer).toBe('Alice');
    expect(shape.createdAt).toBe('2026-03-25T08:00:00Z');
  });

  it('converts an all-day event', () => {
    const raw: CalendarEventRaw = {
      id: 'evt_allday',
      summary: 'Holiday',
      start: { date: '2026-04-01' },
      end: { date: '2026-04-02' },
    };
    const shape = rawEventToShape(raw);
    expect(shape.allDay).toBe(true);
    expect(shape.start).toBe('2026-04-01');
    expect(shape.end).toBe('2026-04-02');
  });

  it('handles event with no attendees', () => {
    const raw: CalendarEventRaw = {
      id: 'evt_solo',
      summary: 'Focus Time',
      start: { dateTime: '2026-03-30T14:00:00Z' },
      end: { dateTime: '2026-03-30T16:00:00Z' },
    };
    const shape = rawEventToShape(raw);
    expect(shape.attendees).toEqual([]);
    expect(shape.attendeeNames).toBeUndefined();
  });

  it('handles event with no start/end objects', () => {
    const raw: CalendarEventRaw = { id: 'evt_empty' };
    const shape = rawEventToShape(raw);
    expect(shape.start).toBeUndefined();
    expect(shape.end).toBeUndefined();
    expect(shape.allDay).toBe(false);
  });

  it('uses organizer email when displayName is absent', () => {
    const raw: CalendarEventRaw = {
      id: 'evt_org',
      organizer: { email: 'org@example.com' },
      start: { dateTime: '2026-03-30T09:00:00Z' },
      end: { dateTime: '2026-03-30T10:00:00Z' },
    };
    const shape = rawEventToShape(raw);
    expect(shape.organizer).toBe('org@example.com');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// rawFileToShape
// ─────────────────────────────────────────────────────────────────────────────

describe('rawFileToShape', () => {
  it('converts a Google Doc with owner', () => {
    const raw: DriveFileRaw = {
      id: 'doc1',
      name: 'Meeting Notes',
      mimeType: 'application/vnd.google-apps.document',
      modifiedTime: '2026-03-29T08:00:00.000Z',
      createdTime: '2026-01-15T09:00:00.000Z',
      owners: [{ displayName: 'Alice', emailAddress: 'alice@example.com', me: true }],
      webViewLink: 'https://docs.google.com/document/d/doc1/edit',
      starred: true,
      shared: false,
      parents: ['folder1'],
    };
    const shape = rawFileToShape(raw);
    expect(shape.id).toBe('doc1');
    expect(shape.name).toBe('Meeting Notes');
    expect(shape.mimeTypeLabel).toBe('Google Doc');
    expect(shape.ownerName).toBe('Alice');
    expect(shape.ownerEmail).toBe('alice@example.com');
    expect(shape.starred).toBe(true);
    expect(shape.parents).toEqual(['folder1']);
  });

  it('handles file with no name', () => {
    const raw: DriveFileRaw = { id: 'noname' };
    const shape = rawFileToShape(raw);
    expect(shape.name).toBe('Untitled');
    expect(shape.mimeType).toBe('');
  });

  it('handles file with no owners', () => {
    const raw: DriveFileRaw = { id: 'noowner', name: 'Orphan', mimeType: 'text/plain' };
    const shape = rawFileToShape(raw);
    expect(shape.ownerName).toBeUndefined();
    expect(shape.ownerEmail).toBeUndefined();
  });

  it('labels known MIME types', () => {
    const mimeTests: Array<[string, string]> = [
      ['application/vnd.google-apps.spreadsheet', 'Google Sheet'],
      ['application/vnd.google-apps.presentation', 'Google Slides'],
      ['application/pdf', 'PDF'],
      ['text/csv', 'CSV'],
      ['image/png', 'PNG Image'],
    ];
    for (const [mime, label] of mimeTests) {
      const raw: DriveFileRaw = { id: 'test', name: 'f', mimeType: mime };
      expect(rawFileToShape(raw).mimeTypeLabel).toBe(label);
    }
  });

  it('falls back to MIME subtype for unknown types', () => {
    const raw: DriveFileRaw = { id: 'test', name: 'f', mimeType: 'application/x-custom-thing' };
    expect(rawFileToShape(raw).mimeTypeLabel).toBe('x-custom-thing');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getMimeTypeLabel
// ─────────────────────────────────────────────────────────────────────────────

describe('getMimeTypeLabel', () => {
  it('returns label for known types', () => {
    expect(getMimeTypeLabel('application/vnd.google-apps.document')).toBe('Google Doc');
    expect(getMimeTypeLabel('application/vnd.google-apps.folder')).toBe('Folder');
  });

  it('extracts subtype for unknown types', () => {
    expect(getMimeTypeLabel('audio/mpeg')).toBe('mpeg');
  });

  it('returns empty string subtype for empty mime type', () => {
    // ''.split('/').pop() returns '' — not null/undefined, so ?? doesn't trigger
    expect(getMimeTypeLabel('')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatRelative
// ─────────────────────────────────────────────────────────────────────────────

describe('formatRelative', () => {
  it('returns "just now" for recent times', () => {
    const now = new Date();
    expect(formatRelative(now.toISOString())).toBe('just now');
  });

  it('returns minutes ago', () => {
    const date = new Date(Date.now() - 5 * 60_000);
    expect(formatRelative(date.toISOString())).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const date = new Date(Date.now() - 3 * 60 * 60_000);
    expect(formatRelative(date.toISOString())).toBe('3h ago');
  });

  it('returns days ago', () => {
    const date = new Date(Date.now() - 7 * 24 * 60 * 60_000);
    expect(formatRelative(date.toISOString())).toBe('7d ago');
  });

  it('returns formatted date for old dates', () => {
    const date = new Date(Date.now() - 60 * 24 * 60 * 60_000);
    const result = formatRelative(date.toISOString());
    // Should be a locale date string, not "Xd ago"
    expect(result).not.toContain('d ago');
  });
});
