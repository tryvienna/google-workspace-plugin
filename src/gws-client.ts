/**
 * GWS Client — child_process wrapper around the `gws` CLI binary.
 *
 * All Google Workspace API interactions go through this client.
 * The `gws` binary handles auth, discovery, pagination, and formatting.
 *
 * Each method validates the CLI response against a Zod schema to ensure
 * the contract between the plugin and the binary is enforced at runtime.
 */

import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import type { ZodType } from 'zod';
import { z } from 'zod';
import {
  GwsAuthStatusResponseSchema,
  GmailThreadsListResponseSchema,
  GmailThreadGetResponseSchema,
  GmailMessageSchema,
  GmailAttachmentDataSchema,
  CalendarAgendaResponseSchema,
  CalendarEventsListResponseSchema,
  CalendarEventRawSchema,
  DriveFilesListResponseSchema,
  DriveFileRawSchema,
  DocsDocumentResponseSchema,
  type GwsAuthStatusResponse,
  type GmailThreadsListResponse,
  type GmailThreadGetResponse,
  type GmailMessage,
  type GmailAttachmentData,
  type CalendarAgendaResponse,
  type CalendarEventsListResponse,
  type CalendarEventRaw,
  type DriveFilesListResponse,
  type DriveFileRaw,
  type DocsDocumentResponse,
} from './gws-schemas';

const execFileAsync = promisify(execFile);

// ─────────────────────────────────────────────────────────────────────────────
// Shell environment resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the user's full shell environment. In packaged Electron apps launched
 * from Dock/Finder, process.env.PATH is minimal (/usr/bin:/bin:/usr/sbin:/sbin)
 * and won't include Homebrew, nvm, or other user-installed paths. We invoke the
 * user's login shell once to get the real PATH, then cache it.
 */
let cachedEnv: Record<string, string> | null = null;

function getShellEnv(): Record<string, string> {
  if (cachedEnv) return cachedEnv;

  // On Windows, GUI apps inherit the full user environment already.
  if (process.platform === 'win32') {
    cachedEnv = process.env as Record<string, string>;
    return cachedEnv;
  }

  const shell = process.env.SHELL || '/bin/zsh';
  try {
    // Source the rc file (.zshrc/.bashrc) inside a login shell to pick up
    // tools configured in interactive shells (nvm, pyenv, homebrew, etc.)
    // without using -i which can cause SIGTTIN issues.
    let rcSource = '';
    if (shell.endsWith('/zsh') || shell.endsWith('/bin/zsh')) {
      rcSource = '[ -f "$HOME/.zshrc" ] && . "$HOME/.zshrc" 2>/dev/null; ';
    } else if (shell.endsWith('/bash') || shell.endsWith('/bin/bash')) {
      rcSource = '[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc" 2>/dev/null; ';
    }

    const output = execFileSync(shell, ['-lc', `${rcSource}env -0`], {
      encoding: 'utf-8',
      timeout: 5_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const env: Record<string, string> = {};
    for (const entry of output.split('\0')) {
      if (!entry) continue;
      const idx = entry.indexOf('=');
      if (idx > 0) {
        env[entry.slice(0, idx)] = entry.slice(idx + 1);
      }
    }

    cachedEnv = { ...(process.env as Record<string, string>), ...env };
  } catch {
    // Fall back to process.env if shell resolution fails
    cachedEnv = process.env as Record<string, string>;
  }
  return cachedEnv;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error types
// ─────────────────────────────────────────────────────────────────────────────

export enum GwsExitCode {
  SUCCESS = 0,
  API_ERROR = 1,
  AUTH_ERROR = 2,
  VALIDATION_ERROR = 3,
  DISCOVERY_ERROR = 4,
  INTERNAL_ERROR = 5,
}

export class GwsError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'GwsError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────────────────────

export class GwsClient {
  private binaryPath: string;
  private timeout: number;

  constructor(opts?: { binaryPath?: string; timeout?: number }) {
    this.binaryPath = opts?.binaryPath ?? 'gws';
    this.timeout = opts?.timeout ?? 30_000;
  }

  /** Run a raw gws command and return parsed JSON. */
  async exec<T = unknown>(args: string[]): Promise<T> {
    const finalArgs = args.includes('--format') ? args : [...args, '--format', 'json'];
    try {
      const { stdout } = await execFileAsync(this.binaryPath, finalArgs, {
        timeout: this.timeout,
        maxBuffer: 10 * 1024 * 1024,
        env: getShellEnv(),
      });
      // gws may print "Using keyring backend: keyring" to stdout before JSON (observed in gws 0.16.0)
      const trimmed = stdout.replace(/^Using keyring backend:.*\n?/m, '').trim();
      if (!trimmed) {
        throw new GwsError('Unexpected empty response from gws CLI', GwsExitCode.INTERNAL_ERROR, '');
      }
      return JSON.parse(trimmed) as T;
    } catch (err: any) {
      const exitCode = err.code ?? err.status ?? GwsExitCode.INTERNAL_ERROR;
      const stderr = err.stderr ?? '';
      if (exitCode === GwsExitCode.AUTH_ERROR) {
        throw new GwsError(
          'Not authenticated. Run `gws auth login` in your terminal.',
          exitCode,
          stderr,
        );
      }
      throw new GwsError(
        `gws command failed: ${stderr || err.message}`,
        typeof exitCode === 'number' ? exitCode : GwsExitCode.INTERNAL_ERROR,
        stderr,
      );
    }
  }

  /** Run a gws command and validate the response against a Zod schema. */
  private async execValidated<T extends ZodType>(args: string[], schema: T): Promise<z.output<T>> {
    const raw = await this.exec(args);
    return schema.parse(raw);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  /** Check authentication status. Returns true if authenticated with a valid token. */
  async isAuthenticated(): Promise<boolean> {
    try {
      const status = await this.execValidated(['auth', 'status'], GwsAuthStatusResponseSchema);
      return status.token_valid === true;
    } catch {
      return false;
    }
  }

  /** Get detailed auth status info. */
  async authStatus(): Promise<GwsAuthStatusResponse> {
    return this.execValidated(['auth', 'status'], GwsAuthStatusResponseSchema);
  }

  // ── Gmail ─────────────────────────────────────────────────────────────────

  async gmailThreadsList(params: Record<string, unknown>): Promise<GmailThreadsListResponse> {
    return this.execValidated(
      ['gmail', 'users', 'threads', 'list', '--params', JSON.stringify({ userId: 'me', ...params })],
      GmailThreadsListResponseSchema,
    );
  }

  /** Fetch thread with metadata (headers only, no body). Used for listing. */
  async gmailThreadsGetMetadata(threadId: string): Promise<GmailThreadGetResponse> {
    return this.execValidated(
      ['gmail', 'users', 'threads', 'get', '--params', JSON.stringify({ userId: 'me', id: threadId, format: 'metadata' })],
      GmailThreadGetResponseSchema,
    );
  }

  /** Fetch thread with full message bodies. Used for drawer detail view. */
  async gmailThreadsGetFull(threadId: string): Promise<GmailThreadGetResponse> {
    return this.execValidated(
      ['gmail', 'users', 'threads', 'get', '--params', JSON.stringify({ userId: 'me', id: threadId, format: 'full' })],
      GmailThreadGetResponseSchema,
    );
  }

  async gmailMessagesGet(messageId: string): Promise<GmailMessage> {
    return this.execValidated(
      ['gmail', 'users', 'messages', 'get', '--params', JSON.stringify({ userId: 'me', id: messageId, format: 'full' })],
      GmailMessageSchema,
    );
  }

  /** Fetch attachment data by messageId and attachmentId. Returns base64url-encoded content. */
  async gmailAttachmentsGet(messageId: string, attachmentId: string): Promise<GmailAttachmentData> {
    return this.execValidated(
      ['gmail', 'users', 'messages', 'attachments', 'get', '--params', JSON.stringify({ userId: 'me', messageId, id: attachmentId })],
      GmailAttachmentDataSchema,
    );
  }

  async gmailSend(to: string, subject: string, body: string) {
    return this.exec(['gmail', '+send', '--to', to, '--subject', subject, '--body', body]);
  }

  // ── Calendar ──────────────────────────────────────────────────────────────

  async calendarAgenda(): Promise<CalendarAgendaResponse> {
    return this.execValidated(['calendar', '+agenda'], CalendarAgendaResponseSchema);
  }

  async calendarEventsList(params: Record<string, unknown>): Promise<CalendarEventsListResponse> {
    return this.execValidated(
      ['calendar', 'events', 'list', '--params', JSON.stringify({ calendarId: 'primary', ...params })],
      CalendarEventsListResponseSchema,
    );
  }

  async calendarEventsGet(eventId: string, calendarId = 'primary'): Promise<CalendarEventRaw> {
    return this.execValidated(
      ['calendar', 'events', 'get', '--params', JSON.stringify({ calendarId, eventId })],
      CalendarEventRawSchema,
    );
  }

  async calendarInsertEvent(opts: {
    summary: string;
    start: string;
    end: string;
    attendees?: string[];
  }) {
    const args = ['calendar', '+insert', '--summary', opts.summary, '--start', opts.start, '--end', opts.end];
    for (const a of opts.attendees ?? []) {
      args.push('--attendee', a);
    }
    return this.exec(args);
  }

  // ── Drive ─────────────────────────────────────────────────────────────────

  async driveFilesList(params: Record<string, unknown>): Promise<DriveFilesListResponse> {
    return this.execValidated(
      ['drive', 'files', 'list', '--params', JSON.stringify(params)],
      DriveFilesListResponseSchema,
    );
  }

  async driveFilesGet(fileId: string, fields?: string): Promise<DriveFileRaw> {
    const params: Record<string, unknown> = { fileId };
    if (fields) params.fields = fields;
    return this.execValidated(
      ['drive', 'files', 'get', '--params', JSON.stringify(params)],
      DriveFileRawSchema,
    );
  }

  // ── Docs ─────────────────────────────────────────────────────────────────

  async docsDocumentsGet(documentId: string): Promise<DocsDocumentResponse> {
    return this.execValidated(
      ['docs', 'documents', 'get', '--params', JSON.stringify({ documentId })],
      DocsDocumentResponseSchema,
    );
  }

  /** Create a new blank Google Doc with the given title. */
  async docsDocumentsCreate(title: string): Promise<DocsDocumentResponse> {
    return this.execValidated(
      ['docs', 'documents', 'create', '--json', JSON.stringify({ title })],
      DocsDocumentResponseSchema,
    );
  }

  /** Apply batch updates to a Google Doc (insert, delete, replace text, formatting, etc.). */
  async docsDocumentsBatchUpdate(
    documentId: string,
    requests: Record<string, unknown>[],
  ): Promise<unknown> {
    return this.exec([
      'docs', 'documents', 'batchUpdate',
      '--params', JSON.stringify({ documentId }),
      '--json', JSON.stringify({ requests }),
    ]);
  }

  /** Append plain text to the end of a Google Doc. */
  async docsAppendText(documentId: string, text: string): Promise<unknown> {
    return this.exec([
      'docs', '+write',
      '--document', documentId,
      '--text', text,
    ]);
  }
}
