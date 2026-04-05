/**
 * Google Workspace GraphQL schema registration.
 *
 * Registers all GWS-specific GraphQL types, queries, mutations,
 * and entity handlers on the Pothos builder.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { GraphQLError } from 'graphql';
import { buildEntityURI } from '@tryvienna/sdk';
import type { BaseEntity } from '@tryvienna/sdk';
import { gmailThreadEntity, calendarEventEntity, driveFileEntity, docsDocumentEntity } from './entities';
import { GMAIL_THREAD_URI_PATH, CALENDAR_EVENT_URI_PATH, DRIVE_FILE_URI_PATH, DOCS_DOCUMENT_URI_PATH } from './entities/uri';
import { googleWorkspaceIntegration } from './integration';
import { GwsClient } from './gws-client';
import * as api from './api';
import type {
  GmailThreadShape,
  GmailMessageShape,
  GmailAttachmentShape,
  CalendarEventShape,
  CalendarAttendeeShape,
  DriveFileShape,
  GwsAuthStatusShape,
} from './helpers';
import type { DocsDocumentShape, GmailAttachmentDownload } from './api';
import type { StoredSuggestion, StoredSuggestionPart } from './suggestion-store';
import * as suggestionStore from './suggestion-store';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getGwsClient(ctx: any): Promise<GwsClient> {
  const client = await ctx.getIntegrationClient?.('google_workspace');
  if (!client) {
    throw new GraphQLError('Google Workspace not connected. Run `gws auth login` in your terminal.', {
      extensions: { code: 'INTEGRATION_NOT_AVAILABLE' },
    });
  }
  return client as GwsClient;
}

async function getGwsClientOrNull(ctx: any): Promise<GwsClient | null> {
  const client = await ctx.getIntegrationClient?.('google_workspace');
  return (client as GwsClient) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema Registration
// ─────────────────────────────────────────────────────────────────────────────

export function registerGoogleWorkspaceSchema(rawBuilder: unknown): void {
  const builder = rawBuilder as any;

  // ── Object Types ─────────────────────────────────────────────────────────

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const GwsAuthStatusRef = builder.objectRef<GwsAuthStatusShape>('GwsAuthStatus');
  builder.objectType(GwsAuthStatusRef, {
    description: 'Google Workspace CLI authentication status',
    fields: (t) => ({
      authenticated: t.exposeBoolean('authenticated'),
      email: t.exposeString('email', { nullable: true }),
      tokenError: t.exposeString('tokenError', { nullable: true }),
    }),
  });

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const GwsMutationResultRef = builder.objectRef<{ success: boolean; message: string }>('GwsMutationResult');
  builder.objectType(GwsMutationResultRef, {
    description: 'Result of a Google Workspace mutation',
    fields: (t) => ({
      success: t.exposeBoolean('success'),
      message: t.exposeString('message'),
    }),
  });

  // ── Gmail Types ──────────────────────────────────────────────────────────

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const GmailAttachmentRef = builder.objectRef<GmailAttachmentShape>('GmailAttachment');
  builder.objectType(GmailAttachmentRef, {
    description: 'Metadata for a Gmail message attachment',
    fields: (t) => ({
      attachmentId: t.exposeString('attachmentId'),
      filename: t.exposeString('filename'),
      mimeType: t.exposeString('mimeType'),
      size: t.exposeInt('size'),
    }),
  });

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const GmailAttachmentDownloadRef = builder.objectRef<GmailAttachmentDownload>('GmailAttachmentDownload');
  builder.objectType(GmailAttachmentDownloadRef, {
    description: 'Attachment data fetched from Gmail (base64url-encoded)',
    fields: (t) => ({
      messageId: t.exposeString('messageId'),
      attachmentId: t.exposeString('attachmentId'),
      filename: t.exposeString('filename'),
      mimeType: t.exposeString('mimeType'),
      data: t.exposeString('data', { description: 'base64url-encoded attachment content' }),
      size: t.exposeInt('size'),
    }),
  });

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const GmailMessageRef = builder.objectRef<GmailMessageShape>('GmailMessage');
  builder.objectType(GmailMessageRef, {
    description: 'A single email message',
    fields: (t) => ({
      id: t.exposeString('id'),
      threadId: t.exposeString('threadId'),
      from: t.exposeString('from', { nullable: true }),
      to: t.exposeString('to', { nullable: true }),
      subject: t.exposeString('subject', { nullable: true }),
      date: t.exposeString('date', { nullable: true }),
      snippet: t.exposeString('snippet', { nullable: true }),
      body: t.exposeString('body', { nullable: true }),
      bodyHtml: t.exposeString('bodyHtml', { nullable: true }),
      labelIds: t.exposeStringList('labelIds', { nullable: true }),
      attachments: t.field({
        type: [GmailAttachmentRef],
        nullable: true,
        resolve: (msg) => msg.attachments ?? null,
      }),
    }),
  });

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const GmailThreadRef = builder.objectRef<GmailThreadShape>('GmailThread');
  builder.objectType(GmailThreadRef, {
    description: 'A Gmail email thread',
    fields: (t) => ({
      id: t.exposeString('id'),
      snippet: t.exposeString('snippet', { nullable: true }),
      subject: t.exposeString('subject', { nullable: true }),
      from: t.exposeString('from', { nullable: true }),
      to: t.exposeString('to', { nullable: true }),
      date: t.exposeString('date', { nullable: true }),
      unread: t.exposeBoolean('unread', { nullable: true }),
      messageCount: t.exposeInt('messageCount', { nullable: true }),
      labelIds: t.exposeStringList('labelIds', { nullable: true }),
      messages: t.field({
        type: [GmailMessageRef],
        nullable: true,
        resolve: (thread) => thread.messages ?? null,
      }),
    }),
  });

  // ── Calendar Types ───────────────────────────────────────────────────────

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const CalendarAttendeeRef = builder.objectRef<CalendarAttendeeShape>('CalendarAttendee');
  builder.objectType(CalendarAttendeeRef, {
    description: 'An attendee of a calendar event',
    fields: (t) => ({
      email: t.exposeString('email'),
      displayName: t.exposeString('displayName', { nullable: true }),
      responseStatus: t.exposeString('responseStatus', { nullable: true }),
      self: t.exposeBoolean('self', { nullable: true }),
    }),
  });

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const CalendarEventRef = builder.objectRef<CalendarEventShape>('CalendarEvent');
  builder.objectType(CalendarEventRef, {
    description: 'A Google Calendar event',
    fields: (t) => ({
      id: t.exposeString('id'),
      summary: t.exposeString('summary', { nullable: true }),
      description: t.exposeString('description', { nullable: true }),
      location: t.exposeString('location', { nullable: true }),
      start: t.exposeString('start', { nullable: true }),
      end: t.exposeString('end', { nullable: true }),
      startFormatted: t.exposeString('startFormatted', { nullable: true }),
      endFormatted: t.exposeString('endFormatted', { nullable: true }),
      allDay: t.exposeBoolean('allDay', { nullable: true }),
      status: t.exposeString('status', { nullable: true }),
      htmlLink: t.exposeString('htmlLink', { nullable: true }),
      organizer: t.exposeString('organizer', { nullable: true }),
      hangoutLink: t.exposeString('hangoutLink', { nullable: true }),
      attendeeNames: t.exposeString('attendeeNames', { nullable: true }),
      createdAt: t.exposeString('createdAt', { nullable: true }),
      updatedAt: t.exposeString('updatedAt', { nullable: true }),
      attendees: t.field({
        type: [CalendarAttendeeRef],
        nullable: true,
        resolve: (event) => event.attendees ?? null,
      }),
    }),
  });

  // ── Drive Types ──────────────────────────────────────────────────────────

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const DriveFileRef = builder.objectRef<DriveFileShape>('DriveFile');
  builder.objectType(DriveFileRef, {
    description: 'A Google Drive file',
    fields: (t) => ({
      id: t.exposeString('id'),
      name: t.exposeString('name'),
      mimeType: t.exposeString('mimeType'),
      mimeTypeLabel: t.exposeString('mimeTypeLabel', { nullable: true }),
      modifiedTime: t.exposeString('modifiedTime', { nullable: true }),
      createdTime: t.exposeString('createdTime', { nullable: true }),
      size: t.exposeString('size', { nullable: true }),
      ownerName: t.exposeString('ownerName', { nullable: true }),
      ownerEmail: t.exposeString('ownerEmail', { nullable: true }),
      webViewLink: t.exposeString('webViewLink', { nullable: true }),
      webContentLink: t.exposeString('webContentLink', { nullable: true }),
      starred: t.exposeBoolean('starred', { nullable: true }),
      shared: t.exposeBoolean('shared', { nullable: true }),
    }),
  });

  // ── Docs Types ─────────────────────────────────────────────────────────

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const DocsDocumentRef = builder.objectRef<DocsDocumentShape>('DocsDocument');
  builder.objectType(DocsDocumentRef, {
    description: 'A Google Docs document with raw JSON content for client-side rendering',
    fields: (t) => ({
      documentId: t.exposeString('documentId'),
      title: t.exposeString('title'),
      rawJson: t.exposeString('rawJson', { description: 'Full Google Docs API JSON as a string' }),
      plainText: t.exposeString('plainText', { description: 'Plain text content extracted from the document body' }),
    }),
  });

  // ── Suggestion Types ────────────────────────────────────────────────────

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const DocSuggestionPartRef = builder.objectRef<StoredSuggestionPart>('DocSuggestionPart');
  builder.objectType(DocSuggestionPartRef, {
    description: 'A single atomic change within a document suggestion',
    fields: (t) => ({
      id: t.exposeString('id'),
      status: t.exposeString('status'),
      changeType: t.exposeString('changeType'),
      granularity: t.exposeString('granularity'),
      original: t.exposeString('original', { nullable: true }),
      proposed: t.exposeString('proposed', { nullable: true }),
    }),
  });

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const DocSuggestionRef = builder.objectRef<StoredSuggestion>('DocSuggestion');
  builder.objectType(DocSuggestionRef, {
    description: 'An AI suggestion for a Google Doc',
    fields: (t) => ({
      id: t.exposeString('id'),
      documentId: t.exposeString('documentId'),
      description: t.exposeString('description'),
      rationale: t.exposeString('rationale', { nullable: true }),
      source: t.exposeString('source'),
      category: t.exposeString('category', { nullable: true }),
      confidence: t.exposeFloat('confidence', { nullable: true }),
      status: t.exposeString('status'),
      createdAt: t.exposeString('createdAt'),
      parts: t.field({
        type: [DocSuggestionPartRef],
        resolve: (sug) => sug.parts,
      }),
    }),
  });

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const AddSuggestionsResultRef = builder.objectRef<{ added: number; suggestions: StoredSuggestion[] }>('AddSuggestionsResult');
  builder.objectType(AddSuggestionsResultRef, {
    description: 'Result of adding document suggestions',
    fields: (t) => ({
      added: t.exposeInt('added'),
      suggestions: t.field({
        type: [DocSuggestionRef],
        resolve: (r) => r.suggestions,
      }),
    }),
  });

  // ── Queries ──────────────────────────────────────────────────────────────

  builder.queryFields((t) => ({
    gwsAuthStatus: t.field({
      type: GwsAuthStatusRef,
      description: 'Check gws CLI authentication status',
      resolve: async (_root, _args, ctx) => {
        // Always create a fresh client to check auth — don't rely on integration client
        // since it returns null when token is expired
        const tempClient = new GwsClient();
        return api.checkAuthStatus(tempClient);
      },
    }),

    // ── Gmail Queries ────────────────────────────────────────────────────

    gmailThreads: t.field({
      type: [GmailThreadRef],
      description: 'List Gmail threads. Returns empty array if not authenticated.',
      args: {
        query: t.arg.string({ description: 'Gmail search query (e.g. "is:unread", "from:alice@")' }),
        limit: t.arg.int({ defaultValue: 20, description: 'Max threads to return (1-100)' }),
      },
      resolve: async (_root, args, ctx) => {
        const client = await getGwsClientOrNull(ctx);
        if (!client) return [];
        return api.listThreads(client, {
          query: args.query ?? undefined,
          maxResults: Math.min(Math.max(args.limit ?? 20, 1), 100),
        });
      },
    }),

    gmailThread: t.field({
      type: GmailThreadRef,
      nullable: true,
      description: 'Get a single Gmail thread by ID',
      args: { threadId: t.arg.string({ required: true }) },
      resolve: async (_root, args, ctx) => {
        const client = await getGwsClient(ctx);
        return api.getThread(client, { threadId: args.threadId });
      },
    }),

    gmailAttachment: t.field({
      type: GmailAttachmentDownloadRef,
      nullable: true,
      description: 'Fetch attachment data from a Gmail message',
      args: {
        messageId: t.arg.string({ required: true }),
        attachmentId: t.arg.string({ required: true }),
        filename: t.arg.string({ required: true }),
        mimeType: t.arg.string({ required: true }),
      },
      resolve: async (_root, args, ctx) => {
        const client = await getGwsClient(ctx);
        return api.getAttachment(client, {
          messageId: args.messageId,
          attachmentId: args.attachmentId,
          filename: args.filename,
          mimeType: args.mimeType,
        });
      },
    }),

    // ── Calendar Queries ─────────────────────────────────────────────────

    calendarAgenda: t.field({
      type: [CalendarEventRef],
      description: 'Get upcoming calendar events (agenda view). Returns empty array if not authenticated.',
      resolve: async (_root, _args, ctx) => {
        const client = await getGwsClientOrNull(ctx);
        if (!client) return [];
        return api.getAgenda(client);
      },
    }),

    calendarEvents: t.field({
      type: [CalendarEventRef],
      description: 'List calendar events with filters',
      args: {
        timeMin: t.arg.string({ description: 'Start of time range (ISO 8601)' }),
        timeMax: t.arg.string({ description: 'End of time range (ISO 8601)' }),
        query: t.arg.string({ description: 'Free-text search query' }),
        limit: t.arg.int({ defaultValue: 20, description: 'Max events to return (1-100)' }),
      },
      resolve: async (_root, args, ctx) => {
        const client = await getGwsClientOrNull(ctx);
        if (!client) return [];
        return api.listEvents(client, {
          timeMin: args.timeMin ?? undefined,
          timeMax: args.timeMax ?? undefined,
          query: args.query ?? undefined,
          maxResults: Math.min(Math.max(args.limit ?? 20, 1), 100),
        });
      },
    }),

    calendarEvent: t.field({
      type: CalendarEventRef,
      nullable: true,
      description: 'Get a single calendar event by ID',
      args: { eventId: t.arg.string({ required: true }) },
      resolve: async (_root, args, ctx) => {
        const client = await getGwsClient(ctx);
        return api.getEvent(client, { eventId: args.eventId });
      },
    }),

    // ── Drive Queries ────────────────────────────────────────────────────

    driveFiles: t.field({
      type: [DriveFileRef],
      description: 'List Google Drive files. Returns empty array if not authenticated.',
      args: {
        query: t.arg.string({ description: 'Drive search query (e.g. "name contains \'report\'")' }),
        limit: t.arg.int({ defaultValue: 20, description: 'Max files to return (1-100)' }),
      },
      resolve: async (_root, args, ctx) => {
        const client = await getGwsClientOrNull(ctx);
        if (!client) return [];
        return api.listFiles(client, {
          query: args.query ?? undefined,
          pageSize: Math.min(Math.max(args.limit ?? 20, 1), 100),
        });
      },
    }),

    driveFile: t.field({
      type: DriveFileRef,
      nullable: true,
      description: 'Get a single Drive file by ID',
      args: { fileId: t.arg.string({ required: true }) },
      resolve: async (_root, args, ctx) => {
        const client = await getGwsClient(ctx);
        return api.getFile(client, { fileId: args.fileId });
      },
    }),

    // ── Docs Queries ─────────────────────────────────────────────────────

    docsDocuments: t.field({
      type: [DriveFileRef],
      description: 'List Google Docs documents. Returns recent documents or search by name. Use this to find documents to read or edit.',
      args: {
        query: t.arg.string({ description: 'Search by document name' }),
        limit: t.arg.int({ description: 'Max results (default 20, max 100)' }),
      },
      resolve: async (_root, args, ctx) => {
        const client = await getGwsClient(ctx);
        return api.listDocuments(client, {
          query: args.query ?? undefined,
          pageSize: Math.min(Math.max(args.limit ?? 20, 1), 100),
        });
      },
    }),

    docsDocument: t.field({
      type: DocsDocumentRef,
      nullable: true,
      description: 'Read a Google Docs document content by ID. Returns the full document text (plainText) and raw JSON for rendering. Use the document ID from docsDocuments or a Drive file ID.',
      args: { documentId: t.arg.string({ required: true, description: 'Google Docs document ID' }) },
      resolve: async (_root, args, ctx) => {
        const client = await getGwsClient(ctx);
        return api.getDocument(client, { documentId: args.documentId });
      },
    }),

    // ── Suggestion Queries ─────────────────────────────────────────────────

    docsSuggestions: t.field({
      type: [DocSuggestionRef],
      description: 'Get all AI suggestions for a Google Docs document. Returns pending, accepted, and rejected inline edit suggestions with original/proposed text.',
      args: { documentId: t.arg.string({ required: true, description: 'Google Docs document ID' }) },
      resolve: (_root, args) => {
        return suggestionStore.getSuggestions(args.documentId);
      },
    }),
  }));

  // ── Mutations ──────────────────────────────────────────────────────────

  builder.mutationFields((t) => ({
    gwsSendEmail: t.field({
      type: GwsMutationResultRef,
      description: 'Send an email via Gmail',
      args: {
        to: t.arg.string({ required: true }),
        subject: t.arg.string({ required: true }),
        body: t.arg.string({ required: true }),
      },
      resolve: async (_root, args, ctx) => {
        const client = await getGwsClient(ctx);
        return api.sendEmail(client, {
          to: args.to,
          subject: args.subject,
          body: args.body,
        });
      },
    }),

    // ── Suggestion Mutations ──────────────────────────────────────────────

    gwsAddDocSuggestions: t.field({
      type: AddSuggestionsResultRef,
      description: 'Add inline edit suggestions to a Google Docs Drive file. Suggestions appear as inline diffs (tracked changes) in the document viewer. Use this to suggest edits, comment on text, review content, or propose changes to a Google Doc. Read the document first with docsDocument query to get the text.',
      args: {
        documentId: t.arg.string({ required: true, description: 'Google Drive file ID (same as Drive file ID)' }),
        suggestionsJson: t.arg.string({
          required: true,
          description: 'JSON array of suggestions: [{ description, rationale?, source?, category?, confidence?, parts: [{ original, proposed, changeType: "replace"|"insert"|"delete", granularity?: "word"|"sentence"|"paragraph" }] }]. The "original" field must exactly match text in the document.',
        }),
      },
      resolve: (_root, args) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(args.suggestionsJson);
        } catch {
          throw new GraphQLError('suggestionsJson must be a valid JSON string', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        // Normalize: accept a single suggestion object or an array
        const rawInputs: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

        // Validate and normalize each suggestion
        const inputs: suggestionStore.SuggestionInput[] = rawInputs.map((raw: any, i: number) => {
          if (!raw || typeof raw !== 'object') {
            throw new GraphQLError(`Suggestion at index ${i} must be an object`, {
              extensions: { code: 'BAD_USER_INPUT' },
            });
          }
          // If parts is missing but original/proposed are present, wrap into a single part
          let parts = raw.parts;
          if (!parts || !Array.isArray(parts)) {
            if (raw.original !== undefined || raw.proposed !== undefined) {
              parts = [{
                original: raw.original ?? null,
                proposed: raw.proposed ?? null,
                changeType: raw.changeType ?? 'replace',
                granularity: raw.granularity ?? 'sentence',
              }];
            } else {
              throw new GraphQLError(
                `Suggestion at index ${i} must have a "parts" array or "original"/"proposed" fields`,
                { extensions: { code: 'BAD_USER_INPUT' } },
              );
            }
          }
          return {
            description: raw.description ?? 'AI suggestion',
            rationale: raw.rationale,
            source: raw.source,
            category: raw.category,
            confidence: raw.confidence,
            parts: parts.map((p: any) => ({
              original: p.original ?? null,
              proposed: p.proposed ?? null,
              changeType: p.changeType ?? 'replace',
              granularity: p.granularity ?? 'sentence',
            })),
          };
        });

        const added = suggestionStore.addSuggestions(args.documentId, inputs);
        return { added: added.length, suggestions: added };
      },
    }),

    gwsUpdateSuggestionStatus: t.field({
      type: 'Boolean',
      description: 'Accept or reject a suggestion on a Google Docs document. Updates the status of a suggestion or a specific part.',
      args: {
        documentId: t.arg.string({ required: true }),
        suggestionId: t.arg.string({ required: true }),
        partId: t.arg.string({ description: 'Specific part ID (null = update all parts)' }),
        status: t.arg.string({ required: true, description: 'New status: pending, accepted, rejected' }),
      },
      resolve: (_root, args) => {
        return suggestionStore.updateSuggestionStatus(
          args.documentId,
          args.suggestionId,
          args.partId ?? null,
          args.status as suggestionStore.SuggestionStatus,
        );
      },
    }),

    gwsClearDocSuggestions: t.field({
      type: 'Boolean',
      description: 'Clear all AI suggestions for a Google Docs document. Removes all pending, accepted, and rejected suggestions.',
      args: { documentId: t.arg.string({ required: true }) },
      resolve: (_root, args) => {
        return suggestionStore.clearSuggestions(args.documentId);
      },
    }),

    // ── Docs Mutations ────────────────────────────────────────────────────

    gwsCreateDocument: t.field({
      type: DocsDocumentRef,
      description: 'Create a new blank Google Docs document with the given title.',
      args: {
        title: t.arg.string({ required: true, description: 'Title for the new document' }),
      },
      resolve: async (_root, args, ctx) => {
        const client = await getGwsClient(ctx);
        return api.createDocument(client, { title: args.title });
      },
    }),

    gwsAppendToDocument: t.field({
      type: GwsMutationResultRef,
      description: 'Append plain text to the end of a Google Docs document. For simple text additions without formatting.',
      args: {
        documentId: t.arg.string({ required: true, description: 'Google Docs document ID' }),
        text: t.arg.string({ required: true, description: 'Plain text to append to the end of the document' }),
      },
      resolve: async (_root, args, ctx) => {
        const client = await getGwsClient(ctx);
        return api.appendToDocument(client, { documentId: args.documentId, text: args.text });
      },
    }),

    gwsBatchUpdateDocument: t.field({
      type: GwsMutationResultRef,
      description: 'Apply batch update requests to a Google Docs document. Supports insertText, deleteContentRange, replaceAllText, and all Google Docs API batchUpdate request types. For advanced document editing with formatting.',
      args: {
        documentId: t.arg.string({ required: true, description: 'Google Docs document ID' }),
        requestsJson: t.arg.string({
          required: true,
          description: 'JSON array of Google Docs API batchUpdate requests. Example: [{"insertText":{"location":{"index":1},"text":"Hello"}}]',
        }),
      },
      resolve: async (_root, args, ctx) => {
        const client = await getGwsClient(ctx);
        const requests = JSON.parse(args.requestsJson) as Record<string, unknown>[];
        return api.batchUpdateDocument(client, { documentId: args.documentId, requests });
      },
    }),

    // ── Calendar Mutations ──────────────────────────────────────────────

    gwsCreateEvent: t.field({
      type: GwsMutationResultRef,
      description: 'Create a new Google Calendar event',
      args: {
        summary: t.arg.string({ required: true }),
        start: t.arg.string({ required: true, description: 'Start time (ISO 8601)' }),
        end: t.arg.string({ required: true, description: 'End time (ISO 8601)' }),
        attendees: t.arg.stringList({ description: 'Attendee email addresses' }),
      },
      resolve: async (_root, args, ctx) => {
        const client = await getGwsClient(ctx);
        return api.createEvent(client, {
          summary: args.summary,
          start: args.start,
          end: args.end,
          attendees: args.attendees ?? undefined,
        });
      },
    }),
  }));

  // ── Entity Handler Registration ──────────────────────────────────────────

  builder.registerEntityHandlers(gmailThreadEntity, {
    integrations: { google_workspace: googleWorkspaceIntegration },
    resolve: async (id, ctx) => {
      const client = ctx.integrations.google_workspace.client as GwsClient;
      if (!client) return null;
      try {
        const thread = await api.getThread(client, { threadId: id['threadId'] });
        if (!thread) return null;
        return {
          id: thread.id,
          type: 'gmail_thread',
          uri: buildEntityURI('gmail_thread', id, GMAIL_THREAD_URI_PATH),
          title: thread.subject ?? '(no subject)',
          description: thread.snippet ?? `From: ${thread.from ?? 'Unknown'}`,
          createdAt: thread.date ? new Date(thread.date).getTime() : undefined,
        } as BaseEntity;
      } catch {
        return null;
      }
    },
    search: async (query, ctx) => {
      const client = ctx.integrations.google_workspace.client as GwsClient;
      if (!client) return [];
      try {
        const threads = await api.listThreads(client, {
          query: query.query || '',
          maxResults: query.limit ?? 20,
        });
        return threads.map((thread) => ({
          id: thread.id,
          type: 'gmail_thread',
          uri: buildEntityURI('gmail_thread', { threadId: thread.id }, GMAIL_THREAD_URI_PATH),
          title: thread.subject ?? '(no subject)',
          description: thread.snippet ?? `From: ${thread.from ?? 'Unknown'}`,
          createdAt: thread.date ? new Date(thread.date).getTime() : undefined,
        } as BaseEntity));
      } catch {
        return [];
      }
    },
    resolveContext: async (entity) => {
      return `### Gmail Thread: ${entity.title}\n- **URI:** ${entity.uri}\n- ${entity.description ?? ''}`;
    },
  });

  builder.registerEntityHandlers(calendarEventEntity, {
    integrations: { google_workspace: googleWorkspaceIntegration },
    resolve: async (id, ctx) => {
      const client = ctx.integrations.google_workspace.client as GwsClient;
      if (!client) return null;
      try {
        const event = await api.getEvent(client, { eventId: id['eventId'] });
        if (!event) return null;
        return {
          id: event.id,
          type: 'calendar_event',
          uri: buildEntityURI('calendar_event', id, CALENDAR_EVENT_URI_PATH),
          title: event.summary ?? '(no title)',
          description: event.startFormatted ? `${event.startFormatted}${event.location ? ` \u2022 ${event.location}` : ''}` : undefined,
          createdAt: event.createdAt ? new Date(event.createdAt).getTime() : undefined,
          updatedAt: event.updatedAt ? new Date(event.updatedAt).getTime() : undefined,
        } as BaseEntity;
      } catch {
        return null;
      }
    },
    search: async (query, ctx) => {
      const client = ctx.integrations.google_workspace.client as GwsClient;
      if (!client) return [];
      try {
        const events = await api.listEvents(client, {
          query: query.query || undefined,
          maxResults: query.limit ?? 20,
        });
        return events.map((event) => ({
          id: event.id,
          type: 'calendar_event',
          uri: buildEntityURI('calendar_event', { eventId: event.id }, CALENDAR_EVENT_URI_PATH),
          title: event.summary ?? '(no title)',
          description: event.startFormatted ?? undefined,
          createdAt: event.createdAt ? new Date(event.createdAt).getTime() : undefined,
        } as BaseEntity));
      } catch {
        return [];
      }
    },
    resolveContext: async (entity) => {
      return `### Calendar Event: ${entity.title}\n- **URI:** ${entity.uri}\n- ${entity.description ?? ''}`;
    },
  });

  builder.registerEntityHandlers(driveFileEntity, {
    integrations: { google_workspace: googleWorkspaceIntegration },
    resolve: async (id, ctx) => {
      const client = ctx.integrations.google_workspace.client as GwsClient;
      if (!client) return null;
      try {
        const file = await api.getFile(client, { fileId: id['fileId'] });
        if (!file) return null;
        return {
          id: file.id,
          type: 'drive_file',
          uri: buildEntityURI('drive_file', id, DRIVE_FILE_URI_PATH),
          title: file.name,
          description: `${file.mimeTypeLabel ?? file.mimeType}${file.ownerName ? ` \u2022 ${file.ownerName}` : ''}`,
          updatedAt: file.modifiedTime ? new Date(file.modifiedTime).getTime() : undefined,
        } as BaseEntity;
      } catch {
        return null;
      }
    },
    search: async (query, ctx) => {
      const client = ctx.integrations.google_workspace.client as GwsClient;
      if (!client) return [];
      try {
        // Sanitize user input for Drive API query: strip everything except alphanumeric, spaces, hyphens, underscores, dots
        const sanitized = query.query ? query.query.replace(/[^a-zA-Z0-9\s\-_.]/g, '') : '';
        const searchQuery = sanitized ? `name contains '${sanitized}'` : undefined;
        const files = await api.listFiles(client, {
          query: searchQuery,
          pageSize: query.limit ?? 20,
        });
        return files.map((file) => ({
          id: file.id,
          type: 'drive_file',
          uri: buildEntityURI('drive_file', { fileId: file.id }, DRIVE_FILE_URI_PATH),
          title: file.name,
          description: file.mimeTypeLabel ?? file.mimeType,
          updatedAt: file.modifiedTime ? new Date(file.modifiedTime).getTime() : undefined,
        } as BaseEntity));
      } catch {
        return [];
      }
    },
    resolveContext: async (entity, ctx) => {
      const lines = [
        `### Drive File: ${entity.title}`,
        `- **URI:** ${entity.uri}`,
        `- ${entity.description ?? ''}`,
      ];

      // For Google Docs, include the document plain text so AI can read it
      const isGoogleDoc = entity.description?.includes('Google Document') ||
        entity.description?.includes('google-apps.document');
      if (isGoogleDoc) {
        try {
          const client = ctx.integrations.google_workspace?.client as GwsClient | null;
          if (client) {
            // Extract fileId from URI — drive_file URI has fileId segment
            const uriParts = entity.uri.split('/');
            const fileId = uriParts[uriParts.length - 1];
            if (fileId) {
              const doc = await api.getDocument(client, { documentId: fileId });
              lines.push(
                '',
                `**Document ID:** ${doc.documentId}`,
                '',
                '#### Document Content',
                '',
                doc.plainText,
              );
              lines.push(
                '',
                '#### Available Actions',
                '- Use `gwsAddDocSuggestions` mutation to add inline AI suggestions to this document',
                '- Use `docsDocument` query to get the raw JSON for rendering',
              );
            }
          }
        } catch {
          // Failed to fetch document content — return basic context
        }
      }

      return lines.join('\n');
    },
  });

  // ── Google Docs Entity ────────────────────────────────────────────────

  builder.registerEntityHandlers(docsDocumentEntity, {
    integrations: { google_workspace: googleWorkspaceIntegration },
    resolve: async (id, ctx) => {
      const client = ctx.integrations.google_workspace.client as GwsClient;
      if (!client) return null;
      try {
        const doc = await api.getDocument(client, { documentId: id['documentId'] });
        return {
          id: doc.documentId,
          type: 'docs_document',
          uri: buildEntityURI('docs_document', id, DOCS_DOCUMENT_URI_PATH),
          title: doc.title,
          description: 'Google Document',
        } as BaseEntity;
      } catch {
        return null;
      }
    },
    search: async (query, ctx) => {
      const client = ctx.integrations.google_workspace.client as GwsClient;
      if (!client) return [];
      try {
        const sanitized = query.query ? query.query.replace(/[^a-zA-Z0-9\s\-_.]/g, '') : '';
        const docs = await api.listDocuments(client, {
          query: sanitized || undefined,
          pageSize: query.limit ?? 20,
        });
        return docs.map((file) => ({
          id: file.id,
          type: 'docs_document',
          uri: buildEntityURI('docs_document', { documentId: file.id }, DOCS_DOCUMENT_URI_PATH),
          title: file.name,
          description: `Google Document${file.ownerName ? ` • ${file.ownerName}` : ''}`,
          updatedAt: file.modifiedTime ? new Date(file.modifiedTime).getTime() : undefined,
        } as BaseEntity));
      } catch {
        return [];
      }
    },
    resolveContext: async (entity, ctx) => {
      const lines = [
        `### Google Doc: ${entity.title}`,
        `- **URI:** ${entity.uri}`,
        `- **Type:** Google Docs Document`,
      ];

      try {
        const client = ctx.integrations.google_workspace?.client as GwsClient | null;
        if (client) {
          const uriParts = entity.uri.split('/');
          const documentId = uriParts[uriParts.length - 1];
          if (documentId) {
            const doc = await api.getDocument(client, { documentId });
            lines.push(
              '',
              `**Document ID:** ${doc.documentId}`,
              '',
              '#### Document Content',
              '',
              doc.plainText,
              '',
              '#### Available Actions',
              '- Use `gwsAddDocSuggestions` mutation to add inline AI suggestions (tracked changes) to this document',
              '- Use `gwsAppendToDocument` mutation to append text to the end of this document',
              '- Use `gwsBatchUpdateDocument` mutation for advanced editing (insert, delete, replace, format)',
              '- Use `gwsCreateDocument` mutation to create a new Google Doc',
              '- Use `docsDocument` query to get the full document content with raw JSON',
            );
          }
        }
      } catch {
        // Failed to fetch document content — return basic context
      }

      return lines.join('\n');
    },
  });
}
