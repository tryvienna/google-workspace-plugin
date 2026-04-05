/**
 * GmailThreadDrawer — Entity drawer for Gmail threads.
 *
 * Shows thread subject, participants, messages in chronological order.
 * Registered on the gmail_thread entity via `ui: { drawer }`.
 */

import { useState, useCallback } from 'react';
import {
  DrawerBody,
  DrawerPanelFooter,
  Separator,
  Button,
  Badge,
} from '@tryvienna/ui';
import { ExternalLink, ChevronDown, ChevronRight, Mail, Paperclip, Download } from 'lucide-react';
import { parseEntityURI } from '@tryvienna/sdk';
import { usePluginQuery, usePluginClient } from '@tryvienna/sdk/react';
import type { EntityDrawerProps } from '@tryvienna/sdk';
import { GMAIL_THREAD_URI_PATH } from '../entities/uri';
import { GET_GMAIL_THREAD, GET_GMAIL_ATTACHMENT } from '../client/operations';
import { formatRelative } from '../helpers';
import { openExternalUrl } from '../openExternal';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function MetadataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-xs font-medium text-foreground max-w-[60%] text-right truncate">
        {children}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentChipProps {
  messageId: string;
  attachment: {
    attachmentId: string;
    filename: string;
    mimeType: string;
    size: number;
  };
}

function AttachmentChip({ messageId, attachment }: AttachmentChipProps) {
  const client = usePluginClient();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const result = await client.query<{
        gmailAttachment: {
          data: string;
          filename: string;
          mimeType: string;
        } | null;
      }>({
        query: GET_GMAIL_ATTACHMENT,
        variables: {
          messageId,
          attachmentId: attachment.attachmentId,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
        },
        fetchPolicy: 'network-only',
      });

      const att = result.data?.gmailAttachment;
      if (!att?.data) return;

      // Convert base64url → base64 → Blob and trigger download
      const base64 = att.data.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: att.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [client, messageId, attachment]);

  return (
    <div className="flex items-center gap-2 rounded border border-border px-2 py-1.5 bg-muted/30 hover:bg-muted/60 transition-colors">
      <Paperclip size={11} className="text-muted-foreground shrink-0" />
      <span className="text-[11px] flex-1 truncate" title={attachment.filename}>
        {attachment.filename}
      </span>
      {attachment.size > 0 && (
        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatBytes(attachment.size)}
        </span>
      )}
      <button
        type="button"
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        onClick={handleDownload}
        disabled={downloading}
        title="Download"
      >
        <Download size={11} />
      </button>
    </div>
  );
}

function MessageItem({
  message,
  defaultExpanded = false,
}: {
  message: {
    id: string;
    from?: string | null;
    to?: string | null;
    date?: string | null;
    snippet?: string | null;
    body?: string | null;
    bodyHtml?: string | null;
    attachments?: Array<{
      attachmentId: string;
      filename: string;
      mimeType: string;
      size: number;
    }> | null;
  };
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const fromName = message.from?.match(/^([^<]+)/)?.[1]?.trim() ?? message.from ?? 'Unknown';
  const attachments = message.attachments ?? [];

  return (
    <div className="rounded border border-border">
      <button
        type="button"
        className="flex items-center gap-2 w-full p-3 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="text-xs font-medium flex-1 truncate">{fromName}</span>
        {attachments.length > 0 && (
          <Paperclip size={11} className="text-muted-foreground shrink-0" />
        )}
        {message.date && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatRelative(message.date)}
          </span>
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-border">
          {message.to && (
            <div className="text-[10px] text-muted-foreground mt-2 mb-1">
              To: {message.to}
            </div>
          )}
          {message.body ? (
            <div className="text-xs whitespace-pre-wrap mt-2">{message.body}</div>
          ) : message.snippet ? (
            <div className="text-xs text-muted-foreground mt-2">{message.snippet}</div>
          ) : (
            <div className="text-xs text-muted-foreground mt-2 italic">No content</div>
          )}
          {attachments.length > 0 && (
            <div className="mt-3 space-y-1">
              {attachments.map((att) => (
                <AttachmentChip
                  key={att.attachmentId}
                  messageId={message.id}
                  attachment={att}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Drawer
// ─────────────────────────────────────────────────────────────────────────────

export function GmailThreadDrawer({ uri, headerActions, DrawerContainer }: EntityDrawerProps) {
  const { id } = parseEntityURI(uri, GMAIL_THREAD_URI_PATH);
  const threadId = id['threadId'] ?? '';

  const { data, loading, error } = usePluginQuery<{
    gmailThread: {
      id: string;
      subject?: string;
      from?: string;
      to?: string;
      date?: string;
      snippet?: string;
      unread?: boolean;
      messageCount?: number;
      labelIds?: string[];
      messages?: Array<{
        id: string;
        from?: string;
        to?: string;
        subject?: string;
        date?: string;
        snippet?: string;
        body?: string;
        bodyHtml?: string;
        attachments?: Array<{
          attachmentId: string;
          filename: string;
          mimeType: string;
          size: number;
        }> | null;
      }>;
    };
  }>(GET_GMAIL_THREAD, {
    variables: { threadId },
    fetchPolicy: 'cache-and-network',
    skip: !threadId,
  });

  const thread = data?.gmailThread;

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading && !thread) {
    return (
      <DrawerContainer title="Gmail Thread">
        <DrawerBody>
          <div className="space-y-4 animate-pulse">
            <div className="h-4 w-48 bg-muted rounded" />
            <div className="h-3 w-32 bg-muted rounded" />
            <div className="h-20 w-full bg-muted rounded" />
          </div>
        </DrawerBody>
      </DrawerContainer>
    );
  }

  if (error || !thread) {
    return (
      <DrawerContainer title="Gmail Thread">
        <DrawerBody>
          <div className="flex flex-col items-center gap-2 py-8">
            <span className="text-sm text-muted-foreground">
              {error ? 'Failed to load thread' : 'Thread not found'}
            </span>
          </div>
        </DrawerBody>
      </DrawerContainer>
    );
  }

  const messages = thread.messages ?? [];
  const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${thread.id}`;

  return (
    <DrawerContainer
      title={thread.subject ?? '(no subject)'}
      headerActions={headerActions}
      footer={
        <DrawerPanelFooter>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openExternalUrl(gmailUrl)}
            >
              <ExternalLink size={12} className="mr-1" />
              Open in Gmail
            </Button>
          </div>
        </DrawerPanelFooter>
      }
    >
      <DrawerBody>
        <div className="space-y-4">
          {/* Header badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="text-[10px]"
              style={{ backgroundColor: '#EA433520', borderColor: '#EA4335' }}
            >
              <Mail size={10} className="mr-1" />
              Gmail
            </Badge>
            {thread.unread && (
              <Badge variant="default" className="text-[10px] bg-blue-500">Unread</Badge>
            )}
            {thread.messageCount && (
              <Badge variant="outline" className="text-[10px]">
                {thread.messageCount} message{thread.messageCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Metadata */}
          <div className="space-y-1">
            {thread.from && <MetadataRow label="From">{thread.from}</MetadataRow>}
            {thread.to && <MetadataRow label="To">{thread.to}</MetadataRow>}
            {thread.date && <MetadataRow label="Date">{formatRelative(thread.date)}</MetadataRow>}
          </div>

          {thread.snippet && (
            <p className="text-xs text-muted-foreground italic">{thread.snippet}</p>
          )}

          <Separator />

          {/* Messages */}
          <div>
            <span className="text-xs font-medium text-muted-foreground mb-2 block">
              Messages{messages.length > 0 ? ` (${messages.length})` : ''}
            </span>
            <div className="space-y-2">
              {messages.length === 0 ? (
                <p className="text-xs text-muted-foreground">No messages loaded</p>
              ) : (
                messages.map((msg, idx) => (
                  <MessageItem
                    key={msg.id}
                    message={msg}
                    defaultExpanded={idx === messages.length - 1}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </DrawerBody>
    </DrawerContainer>
  );
}
