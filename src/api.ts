/**
 * Google Workspace API wrapper functions.
 *
 * Each function takes a GwsClient and returns shaped data.
 * Errors are wrapped in GraphQLError for schema resolvers.
 */

import { GraphQLError } from 'graphql';
import type { GwsClient } from './gws-client';
import { GwsError } from './gws-client';
import {
  rawThreadToShape,
  rawEventToShape,
  rawAgendaEventToShape,
  rawFileToShape,
  type GmailThreadShape,
  type GmailMessageShape,
  type CalendarEventShape,
  type DriveFileShape,
  type GwsAuthStatusShape,
  rawMessageToShape,
} from './helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────

function wrapGwsError(err: unknown, context: string): never {
  if (err instanceof GraphQLError) throw err;
  if (err instanceof GwsError) {
    throw new GraphQLError(`Google Workspace error: ${err.message}`, {
      extensions: { code: 'GWS_ERROR', exitCode: err.exitCode, context },
    });
  }
  throw err;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

export async function checkAuthStatus(client: GwsClient): Promise<GwsAuthStatusShape> {
  const status = await client.authStatus();
  return {
    authenticated: status.token_valid,
    email: status.user,
    tokenError: status.token_error,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gmail
// ─────────────────────────────────────────────────────────────────────────────

export async function listThreads(
  client: GwsClient,
  input: { query?: string; maxResults?: number },
): Promise<GmailThreadShape[]> {
  try {
    const params: Record<string, unknown> = {};
    if (input.query) params.q = input.query;
    if (input.maxResults) params.maxResults = input.maxResults;
    const result = await client.gmailThreadsList(params);
    const threadStubs = result.threads;
    if (threadStubs.length === 0) return [];

    // threads.list only returns id/snippet — fetch each with metadata to get headers
    const threads = await Promise.all(
      threadStubs.map(async (stub) => {
        try {
          const full = await client.gmailThreadsGetMetadata(stub.id);
          return rawThreadToShape(full);
        } catch (fetchErr) {
          // Fall back to stub data — log so degraded results are visible
          console.warn(`[google_workspace] Failed to fetch thread metadata for ${stub.id}:`, fetchErr);
          return rawThreadToShape(stub);
        }
      }),
    );
    return threads;
  } catch (err) {
    throw wrapGwsError(err, 'listThreads');
  }
}

/** Get a thread with full message bodies (for drawer detail view). */
export async function getThread(
  client: GwsClient,
  input: { threadId: string },
): Promise<GmailThreadShape | null> {
  try {
    const result = await client.gmailThreadsGetFull(input.threadId);
    return rawThreadToShape(result);
  } catch (err) {
    throw wrapGwsError(err, 'getThread');
  }
}

export async function getMessage(
  client: GwsClient,
  input: { messageId: string },
): Promise<GmailMessageShape | null> {
  try {
    const result = await client.gmailMessagesGet(input.messageId);
    return rawMessageToShape(result);
  } catch (err) {
    throw wrapGwsError(err, 'getMessage');
  }
}

export interface GmailAttachmentDownload {
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  /** base64url-encoded attachment data */
  data: string;
  size: number;
}

export async function getAttachment(
  client: GwsClient,
  input: { messageId: string; attachmentId: string; filename: string; mimeType: string },
): Promise<GmailAttachmentDownload> {
  try {
    const result = await client.gmailAttachmentsGet(input.messageId, input.attachmentId);
    return {
      messageId: input.messageId,
      attachmentId: input.attachmentId,
      filename: input.filename,
      mimeType: input.mimeType,
      data: result.data,
      size: result.size ?? 0,
    };
  } catch (err) {
    throw wrapGwsError(err, 'getAttachment');
  }
}

export async function sendEmail(
  client: GwsClient,
  input: { to: string; subject: string; body: string },
): Promise<{ success: boolean; message: string }> {
  try {
    await client.gmailSend(input.to, input.subject, input.body);
    return { success: true, message: 'Email sent successfully' };
  } catch (err) {
    throw wrapGwsError(err, 'sendEmail');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar
// ─────────────────────────────────────────────────────────────────────────────

export async function getAgenda(client: GwsClient): Promise<CalendarEventShape[]> {
  try {
    const result = await client.calendarAgenda();
    return result.events.map(rawAgendaEventToShape);
  } catch (err) {
    throw wrapGwsError(err, 'getAgenda');
  }
}

export async function listEvents(
  client: GwsClient,
  input: { timeMin?: string; timeMax?: string; maxResults?: number; query?: string },
): Promise<CalendarEventShape[]> {
  try {
    const params: Record<string, unknown> = {};
    if (input.timeMin) params.timeMin = input.timeMin;
    if (input.timeMax) params.timeMax = input.timeMax;
    if (input.maxResults) params.maxResults = input.maxResults;
    if (input.query) params.q = input.query;
    params.singleEvents = true;
    params.orderBy = 'startTime';
    const result = await client.calendarEventsList(params);
    return result.items.map(rawEventToShape);
  } catch (err) {
    throw wrapGwsError(err, 'listEvents');
  }
}

export async function getEvent(
  client: GwsClient,
  input: { eventId: string },
): Promise<CalendarEventShape | null> {
  try {
    const result = await client.calendarEventsGet(input.eventId);
    return rawEventToShape(result);
  } catch (err) {
    throw wrapGwsError(err, 'getEvent');
  }
}

export async function createEvent(
  client: GwsClient,
  input: { summary: string; start: string; end: string; attendees?: string[] },
): Promise<{ success: boolean; message: string }> {
  try {
    await client.calendarInsertEvent(input);
    return { success: true, message: 'Event created successfully' };
  } catch (err) {
    throw wrapGwsError(err, 'createEvent');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Drive
// ─────────────────────────────────────────────────────────────────────────────

export async function listFiles(
  client: GwsClient,
  input: { query?: string; pageSize?: number },
): Promise<DriveFileShape[]> {
  try {
    const params: Record<string, unknown> = {
      fields: 'files(id,name,mimeType,modifiedTime,createdTime,size,owners,webViewLink,webContentLink,starred,shared)',
    };
    if (input.query) params.q = input.query;
    if (input.pageSize) params.pageSize = input.pageSize;
    if (!input.query) {
      params.orderBy = 'modifiedTime desc';
    }
    const result = await client.driveFilesList(params);
    return result.files.map(rawFileToShape);
  } catch (err) {
    throw wrapGwsError(err, 'listFiles');
  }
}

export async function getFile(
  client: GwsClient,
  input: { fileId: string },
): Promise<DriveFileShape | null> {
  try {
    const result = await client.driveFilesGet(
      input.fileId,
      'id,name,mimeType,modifiedTime,createdTime,size,owners,webViewLink,webContentLink,starred,shared,parents',
    );
    return rawFileToShape(result);
  } catch (err) {
    throw wrapGwsError(err, 'getFile');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Docs
// ─────────────────────────────────────────────────────────────────────────────

export interface DocsDocumentShape {
  documentId: string;
  title: string;
  rawJson: string;
  /** Plain text extracted from the document body (for AI consumption). */
  plainText: string;
}

/**
 * Extract plain text from Google Docs API JSON body.
 * Walks structural elements → paragraphs → text runs.
 */
function extractPlainText(doc: Record<string, unknown>): string {
  const body = doc['body'] as { content?: unknown[] } | undefined;
  if (!body?.content) return '';

  const parts: string[] = [];
  for (const element of body.content) {
    const el = element as Record<string, unknown>;
    const paragraph = el['paragraph'] as { elements?: unknown[] } | undefined;
    if (paragraph?.elements) {
      for (const pe of paragraph.elements) {
        const textRun = (pe as Record<string, unknown>)['textRun'] as
          | { content?: string }
          | undefined;
        if (textRun?.content) {
          parts.push(textRun.content);
        }
      }
    }
    const table = el['table'] as { tableRows?: unknown[] } | undefined;
    if (table?.tableRows) {
      for (const row of table.tableRows) {
        const cells = (row as Record<string, unknown>)['tableCells'] as unknown[] | undefined;
        if (!cells) continue;
        for (const cell of cells) {
          const content = (cell as Record<string, unknown>)['content'] as unknown[] | undefined;
          if (!content) continue;
          for (const cellEl of content) {
            const p = (cellEl as Record<string, unknown>)['paragraph'] as
              | { elements?: unknown[] }
              | undefined;
            if (p?.elements) {
              for (const pe of p.elements) {
                const textRun = (pe as Record<string, unknown>)['textRun'] as
                  | { content?: string }
                  | undefined;
                if (textRun?.content) {
                  parts.push(textRun.content);
                }
              }
            }
          }
        }
      }
    }
  }
  return parts.join('').trim();
}

export async function getDocument(
  client: GwsClient,
  input: { documentId: string },
): Promise<DocsDocumentShape> {
  try {
    const result = await client.docsDocumentsGet(input.documentId);
    return {
      documentId: result.documentId,
      title: result.title,
      rawJson: JSON.stringify(result),
      plainText: extractPlainText(result as unknown as Record<string, unknown>),
    };
  } catch (err) {
    throw wrapGwsError(err, 'getDocument');
  }
}

/** List Google Docs documents (searches Drive with docs mimeType filter). */
export async function listDocuments(
  client: GwsClient,
  input: { query?: string; pageSize?: number },
): Promise<DriveFileShape[]> {
  try {
    const mimeFilter = "mimeType = 'application/vnd.google-apps.document'";
    const nameFilter = input.query ? ` and name contains '${input.query}'` : '';
    const params: Record<string, unknown> = {
      q: mimeFilter + nameFilter,
      fields: 'files(id,name,mimeType,modifiedTime,createdTime,size,owners,webViewLink,webContentLink,starred,shared)',
      orderBy: 'modifiedTime desc',
    };
    if (input.pageSize) params.pageSize = input.pageSize;
    const result = await client.driveFilesList(params);
    return result.files.map(rawFileToShape);
  } catch (err) {
    throw wrapGwsError(err, 'listDocuments');
  }
}

/** Create a new blank Google Doc. */
export async function createDocument(
  client: GwsClient,
  input: { title: string },
): Promise<DocsDocumentShape> {
  try {
    const result = await client.docsDocumentsCreate(input.title);
    return {
      documentId: result.documentId,
      title: result.title,
      rawJson: JSON.stringify(result),
      plainText: '',
    };
  } catch (err) {
    throw wrapGwsError(err, 'createDocument');
  }
}

/** Append plain text to the end of a document. */
export async function appendToDocument(
  client: GwsClient,
  input: { documentId: string; text: string },
): Promise<{ success: boolean; message: string }> {
  try {
    await client.docsAppendText(input.documentId, input.text);
    return { success: true, message: 'Text appended successfully' };
  } catch (err) {
    throw wrapGwsError(err, 'appendToDocument');
  }
}

/** Apply batch update requests to a document. */
export async function batchUpdateDocument(
  client: GwsClient,
  input: { documentId: string; requests: Record<string, unknown>[] },
): Promise<{ success: boolean; message: string }> {
  try {
    await client.docsDocumentsBatchUpdate(input.documentId, input.requests);
    return { success: true, message: 'Document updated successfully' };
  } catch (err) {
    throw wrapGwsError(err, 'batchUpdateDocument');
  }
}
