/**
 * Google Workspace plugin helpers — shape interfaces and converters.
 *
 * Pure functions that transform validated gws CLI responses (from gws-schemas.ts)
 * into typed shapes consumed by api.ts and schema.ts.
 */

import type {
  GmailThreadGetResponse,
  GmailMessage,
  GmailPayload,
  GmailPart,
  CalendarAgendaEvent,
  CalendarEventRaw,
  DriveFileRaw,
} from './gws-schemas';

// ─────────────────────────────────────────────────────────────────────────────
// Gmail Shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface GmailThreadShape {
  id: string;
  historyId?: string;
  snippet?: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  unread?: boolean;
  messageCount?: number;
  labelIds?: string[];
  messages?: GmailMessageShape[];
}

export interface GmailAttachmentShape {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface GmailMessageShape {
  id: string;
  threadId: string;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  snippet?: string;
  body?: string;
  bodyHtml?: string;
  labelIds?: string[];
  attachments?: GmailAttachmentShape[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar Shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface CalendarEventShape {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: string;
  end?: string;
  startFormatted?: string;
  endFormatted?: string;
  allDay?: boolean;
  status?: string;
  htmlLink?: string;
  attendees?: CalendarAttendeeShape[];
  attendeeNames?: string;
  organizer?: string;
  hangoutLink?: string;
  recurringEventId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CalendarAttendeeShape {
  email: string;
  displayName?: string;
  responseStatus?: string;
  self?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Drive Shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface DriveFileShape {
  id: string;
  name: string;
  mimeType: string;
  mimeTypeLabel?: string;
  modifiedTime?: string;
  createdTime?: string;
  size?: string;
  ownerName?: string;
  ownerEmail?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  starred?: boolean;
  shared?: boolean;
  parents?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Status Shape
// ─────────────────────────────────────────────────────────────────────────────

export interface GwsAuthStatusShape {
  authenticated: boolean;
  email?: string;
  tokenError?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MIME type labels
// ─────────────────────────────────────────────────────────────────────────────

export const MIME_TYPE_LABELS: Record<string, string> = {
  'application/vnd.google-apps.document': 'Google Doc',
  'application/vnd.google-apps.spreadsheet': 'Google Sheet',
  'application/vnd.google-apps.presentation': 'Google Slides',
  'application/vnd.google-apps.form': 'Google Form',
  'application/vnd.google-apps.folder': 'Folder',
  'application/vnd.google-apps.drawing': 'Google Drawing',
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'image/png': 'PNG Image',
  'image/jpeg': 'JPEG Image',
  'image/gif': 'GIF Image',
  'text/plain': 'Text File',
  'text/csv': 'CSV',
  'application/zip': 'ZIP Archive',
  'application/json': 'JSON',
  'video/mp4': 'MP4 Video',
};

export function getMimeTypeLabel(mimeType: string): string {
  return MIME_TYPE_LABELS[mimeType] ?? mimeType.split('/').pop() ?? 'File';
}

// ─────────────────────────────────────────────────────────────────────────────
// Gmail Header Extraction
// ─────────────────────────────────────────────────────────────────────────────

export function getHeader(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const header = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  );
  return header?.value;
}

/**
 * Recursively extract text/plain and text/html body from a Gmail payload.
 *
 * Gmail messages are structured as MIME trees:
 * - Simple message: payload.body.data contains the content
 * - multipart/alternative: payload.parts[] has text/plain + text/html
 * - multipart/mixed: top-level parts with a multipart/alternative sub-part + attachments
 * - Deeper nesting is possible (multipart/related, etc.)
 */
export function getMessageBody(payload: GmailPayload | GmailPart | undefined): { text?: string; html?: string } {
  if (!payload) return {};

  // Simple body (no parts) — data is base64url-encoded
  if (payload.body?.data) {
    const decoded = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
    if (payload.mimeType === 'text/html') return { html: decoded };
    if (payload.mimeType === 'text/plain') return { text: decoded };
    return { text: decoded };
  }

  // Multipart — recurse through parts
  if (payload.parts) {
    let text: string | undefined;
    let html: string | undefined;
    for (const part of payload.parts) {
      const result = getMessageBody(part as GmailPart);
      if (result.text && !text) text = result.text;
      if (result.html && !html) html = result.html;
    }
    return { text, html };
  }

  return {};
}

/**
 * Recursively collect attachment parts from a Gmail payload.
 *
 * A part is an attachment when it has a non-empty filename and its body
 * carries an attachmentId (the data is stored separately on Gmail's servers).
 */
export function getMessageAttachments(payload: GmailPayload | GmailPart | undefined): GmailAttachmentShape[] {
  if (!payload) return [];

  const results: GmailAttachmentShape[] = [];

  if (payload.filename && payload.body?.attachmentId) {
    results.push({
      attachmentId: payload.body.attachmentId,
      filename: payload.filename,
      mimeType: payload.mimeType ?? 'application/octet-stream',
      size: payload.body.size ?? 0,
    });
  }

  for (const part of payload.parts ?? []) {
    results.push(...getMessageAttachments(part as GmailPart));
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gmail Converters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a thread from `threads.list` (minimal: id, snippet, historyId)
 * or from `threads.get` (full: id, messages[]) into a GmailThreadShape.
 */
export function rawThreadToShape(raw: GmailThreadGetResponse | { id: string; snippet?: string; historyId?: string }): GmailThreadShape {
  const messages = 'messages' in raw ? raw.messages : [];
  const firstMessage = messages[0];
  const headers = firstMessage?.payload?.headers ?? [];

  const labelIds = firstMessage?.labelIds ?? [];
  const unread = labelIds.includes('UNREAD');

  const hasMessages = messages.length > 0;

  return {
    id: raw.id,
    historyId: raw.historyId,
    snippet: ('snippet' in raw ? raw.snippet : undefined) ?? firstMessage?.snippet,
    subject: hasMessages ? getHeader(headers, 'Subject') : undefined,
    from: hasMessages ? getHeader(headers, 'From') : undefined,
    to: hasMessages ? getHeader(headers, 'To') : undefined,
    date: hasMessages ? getHeader(headers, 'Date') : undefined,
    unread,
    messageCount: hasMessages ? messages.length : undefined,
    labelIds,
    messages: hasMessages ? messages.map(rawMessageToShape) : undefined,
  };
}

export function rawMessageToShape(raw: GmailMessage): GmailMessageShape {
  const headers = raw.payload?.headers ?? [];
  const body = getMessageBody(raw.payload);
  const attachments = getMessageAttachments(raw.payload);

  return {
    id: raw.id,
    threadId: raw.threadId ?? '',
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    subject: getHeader(headers, 'Subject'),
    date: getHeader(headers, 'Date'),
    snippet: raw.snippet,
    body: body.text,
    bodyHtml: body.html,
    labelIds: raw.labelIds,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar Converters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert an agenda event from `+agenda` (flat ISO strings).
 */
export function rawAgendaEventToShape(raw: CalendarAgendaEvent): CalendarEventShape {
  // +agenda doesn't return an id — synthesize one from summary+start
  const id = `${raw.summary ?? ''}_${raw.start}`;

  return {
    id,
    summary: raw.summary,
    location: raw.location || undefined,
    start: raw.start,
    end: raw.end,
    startFormatted: formatDateTime(raw.start, false),
    endFormatted: formatDateTime(raw.end, false),
    allDay: false,
    organizer: raw.calendar,
  };
}

/**
 * Convert a calendar event from `events.list` or `events.get` (nested dateTime objects).
 */
export function rawEventToShape(raw: CalendarEventRaw): CalendarEventShape {
  const startObj = raw.start ?? {};
  const endObj = raw.end ?? {};
  const allDay = Boolean(startObj.date && !startObj.dateTime);
  const startIso = startObj.dateTime ?? startObj.date;
  const endIso = endObj.dateTime ?? endObj.date;

  const attendees: CalendarAttendeeShape[] = (raw.attendees ?? []).map((a) => ({
    email: a.email,
    displayName: a.displayName,
    responseStatus: a.responseStatus,
    self: a.self,
  }));

  return {
    id: raw.id,
    summary: raw.summary,
    description: raw.description,
    location: raw.location,
    start: startIso,
    end: endIso,
    startFormatted: startIso ? formatDateTime(startIso, allDay) : undefined,
    endFormatted: endIso ? formatDateTime(endIso, allDay) : undefined,
    allDay,
    status: raw.status,
    htmlLink: raw.htmlLink,
    attendees,
    attendeeNames: attendees.length > 0 ? attendees.map((a) => a.displayName ?? a.email).join(', ') : undefined,
    organizer: raw.organizer?.displayName ?? raw.organizer?.email,
    hangoutLink: raw.hangoutLink,
    recurringEventId: raw.recurringEventId,
    createdAt: raw.created,
    updatedAt: raw.updated,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Drive Converter
// ─────────────────────────────────────────────────────────────────────────────

export function rawFileToShape(raw: DriveFileRaw): DriveFileShape {
  const owners = raw.owners ?? [];
  const firstOwner = owners[0];

  return {
    id: raw.id,
    name: raw.name ?? 'Untitled',
    mimeType: raw.mimeType ?? '',
    mimeTypeLabel: getMimeTypeLabel(raw.mimeType ?? ''),
    modifiedTime: raw.modifiedTime,
    createdTime: raw.createdTime,
    size: raw.size,
    ownerName: firstOwner?.displayName,
    ownerEmail: firstOwner?.emailAddress,
    webViewLink: raw.webViewLink,
    webContentLink: raw.webContentLink,
    iconLink: raw.iconLink,
    starred: raw.starred,
    shared: raw.shared,
    parents: raw.parents,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Date formatting
// ─────────────────────────────────────────────────────────────────────────────

function formatDateTime(iso: string, allDay: boolean): string {
  try {
    const date = new Date(iso);
    if (allDay) {
      return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }
    return date.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
