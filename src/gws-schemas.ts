/**
 * Zod schemas for gws CLI JSON output.
 *
 * These define the contract between the plugin and the gws binary.
 * Each schema matches the actual JSON structure returned by a specific
 * gws command (verified against gws 0.16.0).
 *
 * Note: Response schemas use `.passthrough()` intentionally — this allows
 * forward compatibility with newer gws versions that may add fields without
 * requiring a plugin update. Unknown fields pass through validation untouched.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Auth Status — `gws auth status --format json`
// ─────────────────────────────────────────────────────────────────────────────

export const GwsAuthStatusResponseSchema = z.object({
  auth_method: z.string().optional(),
  token_valid: z.boolean(),
  user: z.string().optional(),
  client_id: z.string().optional(),
  project_id: z.string().optional(),
  storage: z.string().optional(),
  token_error: z.string().optional(),
  scope_count: z.number().optional(),
  scopes: z.array(z.string()).optional(),
  has_refresh_token: z.boolean().optional(),
}).passthrough();

export type GwsAuthStatusResponse = z.infer<typeof GwsAuthStatusResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Gmail — `gws gmail users threads list`
// ─────────────────────────────────────────────────────────────────────────────

export const GmailThreadStubSchema = z.object({
  id: z.string(),
  historyId: z.string().optional(),
  snippet: z.string().optional(),
});

export const GmailThreadsListResponseSchema = z.object({
  threads: z.array(GmailThreadStubSchema).optional().default([]),
  nextPageToken: z.string().optional(),
  resultSizeEstimate: z.number().optional(),
});

export type GmailThreadsListResponse = z.infer<typeof GmailThreadsListResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Gmail — `gws gmail users threads get` / `gws gmail users messages get`
// ─────────────────────────────────────────────────────────────────────────────

export const GmailHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export const GmailBodySchema = z.object({
  size: z.number().optional(),
  data: z.string().optional(),
  attachmentId: z.string().optional(),
});

/** Recursive MIME part structure. */
export const GmailPartSchema: z.ZodType<{
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: Array<unknown>;
}> = z.object({
  partId: z.string().optional(),
  mimeType: z.string().optional(),
  filename: z.string().optional(),
  headers: z.array(GmailHeaderSchema).optional(),
  body: GmailBodySchema.optional(),
  parts: z.lazy(() => z.array(GmailPartSchema)).optional(),
}).passthrough();

export const GmailPayloadSchema = z.object({
  partId: z.string().optional(),
  mimeType: z.string().optional(),
  filename: z.string().optional(),
  headers: z.array(GmailHeaderSchema).optional().default([]),
  body: GmailBodySchema.optional(),
  parts: z.array(GmailPartSchema).optional(),
}).passthrough();

export const GmailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string().optional(),
  historyId: z.string().optional(),
  internalDate: z.string().optional(),
  labelIds: z.array(z.string()).optional().default([]),
  snippet: z.string().optional(),
  sizeEstimate: z.number().optional(),
  payload: GmailPayloadSchema.optional(),
});

export const GmailThreadGetResponseSchema = z.object({
  id: z.string(),
  historyId: z.string().optional(),
  messages: z.array(GmailMessageSchema).optional().default([]),
});

export type GmailMessage = z.infer<typeof GmailMessageSchema>;
export type GmailThreadGetResponse = z.infer<typeof GmailThreadGetResponseSchema>;
export type GmailPayload = z.infer<typeof GmailPayloadSchema>;
export type GmailPart = z.infer<typeof GmailPartSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Gmail — `gws gmail users messages attachments get`
// ─────────────────────────────────────────────────────────────────────────────

export const GmailAttachmentDataSchema = z.object({
  size: z.number().optional(),
  data: z.string(), // base64url-encoded attachment content
}).passthrough();

export type GmailAttachmentData = z.infer<typeof GmailAttachmentDataSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Calendar — `gws calendar +agenda`
// ─────────────────────────────────────────────────────────────────────────────

export const CalendarAgendaEventSchema = z.object({
  summary: z.string().optional(),
  start: z.string(),
  end: z.string(),
  location: z.string().optional().default(''),
  calendar: z.string().optional(),
});

export const CalendarAgendaResponseSchema = z.object({
  events: z.array(CalendarAgendaEventSchema).optional().default([]),
  count: z.number().optional(),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
});

export type CalendarAgendaResponse = z.infer<typeof CalendarAgendaResponseSchema>;
export type CalendarAgendaEvent = z.infer<typeof CalendarAgendaEventSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Calendar — `gws calendar events list` / `gws calendar events get`
// ─────────────────────────────────────────────────────────────────────────────

export const CalendarDateTimeSchema = z.object({
  dateTime: z.string().optional(),
  date: z.string().optional(),
  timeZone: z.string().optional(),
});

export const CalendarAttendeeRawSchema = z.object({
  email: z.string(),
  displayName: z.string().optional(),
  responseStatus: z.string().optional(),
  self: z.boolean().optional(),
  organizer: z.boolean().optional(),
}).passthrough();

export const CalendarEventRawSchema = z.object({
  id: z.string(),
  summary: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  start: CalendarDateTimeSchema.optional(),
  end: CalendarDateTimeSchema.optional(),
  status: z.string().optional(),
  htmlLink: z.string().optional(),
  hangoutLink: z.string().optional(),
  attendees: z.array(CalendarAttendeeRawSchema).optional(),
  organizer: z.object({
    email: z.string().optional(),
    displayName: z.string().optional(),
    self: z.boolean().optional(),
  }).optional(),
  creator: z.object({
    email: z.string().optional(),
    displayName: z.string().optional(),
    self: z.boolean().optional(),
  }).optional(),
  recurringEventId: z.string().optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
  eventType: z.string().optional(),
}).passthrough();

export const CalendarEventsListResponseSchema = z.object({
  items: z.array(CalendarEventRawSchema).optional().default([]),
  nextPageToken: z.string().optional(),
  summary: z.string().optional(),
  timeZone: z.string().optional(),
}).passthrough();

export type CalendarEventRaw = z.infer<typeof CalendarEventRawSchema>;
export type CalendarEventsListResponse = z.infer<typeof CalendarEventsListResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Drive — `gws drive files list` / `gws drive files get`
// ─────────────────────────────────────────────────────────────────────────────

export const DriveOwnerSchema = z.object({
  displayName: z.string().optional(),
  emailAddress: z.string().optional(),
  me: z.boolean().optional(),
  kind: z.string().optional(),
  permissionId: z.string().optional(),
  photoLink: z.string().optional(),
}).passthrough();

export const DriveFileRawSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  mimeType: z.string().optional(),
  modifiedTime: z.string().optional(),
  createdTime: z.string().optional(),
  size: z.string().optional(),
  owners: z.array(DriveOwnerSchema).optional(),
  webViewLink: z.string().optional(),
  webContentLink: z.string().optional(),
  iconLink: z.string().optional(),
  starred: z.boolean().optional(),
  shared: z.boolean().optional(),
  parents: z.array(z.string()).optional(),
}).passthrough();

export const DriveFilesListResponseSchema = z.object({
  files: z.array(DriveFileRawSchema).optional().default([]),
  nextPageToken: z.string().optional(),
  incompleteSearch: z.boolean().optional(),
}).passthrough();

export type DriveFileRaw = z.infer<typeof DriveFileRawSchema>;
export type DriveFilesListResponse = z.infer<typeof DriveFilesListResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Docs — `gws docs documents get`
// ─────────────────────────────────────────────────────────────────────────────

export const DocsDocumentResponseSchema = z.object({
  documentId: z.string(),
  title: z.string(),
  body: z.object({
    content: z.array(z.any()),
  }),
  documentStyle: z.any().optional(),
  namedStyles: z.any().optional(),
  lists: z.record(z.any()).optional().default({}),
  inlineObjects: z.record(z.any()).optional().default({}),
  positionedObjects: z.record(z.any()).optional().default({}),
  headers: z.record(z.any()).optional().default({}),
  footers: z.record(z.any()).optional().default({}),
  footnotes: z.record(z.any()).optional().default({}),
}).passthrough();

export type DocsDocumentResponse = z.infer<typeof DocsDocumentResponseSchema>;
