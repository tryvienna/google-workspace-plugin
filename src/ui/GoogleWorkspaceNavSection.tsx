/**
 * GoogleWorkspaceNavSection — Nav sidebar canvas.
 *
 * Four collapsible folders: Inbox (Gmail), Agenda (Calendar), Docs, Recent Files (Drive).
 * Each folder lazily fetches its data only when first expanded.
 * Expanded/collapsed state is persisted to localStorage.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePluginQuery } from '@tryvienna/sdk/react';
import {
  NavSection,
  NavItem,
  NavSettingsButton,
  NavHeaderActions,
} from '@tryvienna/ui';
import type { NavSidebarCanvasProps } from '@tryvienna/sdk';
import { Mail, Calendar, HardDrive, FileText, Settings, ExternalLink, Loader2 } from 'lucide-react';
import { GoogleIcon } from './GoogleIcon';
import { useGoogleWorkspaceSettings } from './useGoogleWorkspaceSettings';
import { GET_GWS_AUTH_STATUS, GET_GMAIL_THREADS, GET_CALENDAR_EVENTS, GET_DRIVE_FILES, GET_DOCS_DOCUMENTS } from '../client/operations';
import { openExternalUrl } from '../openExternal';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'gws-nav-expanded';

function formatEmailFrom(from: string | null | undefined): string {
  if (!from) return 'Unknown';
  const match = from.match(/^([^<]+)/);
  return match ? match[1].trim() : from;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}

function LoadingItem({ id }: { id: string }) {
  return (
    <NavItem
      item={{
        id,
        label: 'Loading\u2026',
        variant: 'item',
        icon: <Loader2 size={12} className="animate-spin text-muted-foreground" />,
      }}
      depth={1}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Folder components — each owns its query
// ─────────────────────────────────────────────────────────────────────────────

interface FolderProps {
  isExpanded: boolean;
  activated: boolean;
  openEntityDrawer: NavSidebarCanvasProps['openEntityDrawer'];
  logger: NavSidebarCanvasProps['logger'];
}

function InboxFolder({ isExpanded, activated, openEntityDrawer, logger }: FolderProps) {
  const { settings } = useGoogleWorkspaceSettings();

  const { data, loading, error } = usePluginQuery<{
    gmailThreads: Array<{
      id: string; subject?: string; from?: string; date?: string;
      snippet?: string; unread?: boolean; messageCount?: number;
    }>;
  }>(GET_GMAIL_THREADS, {
    variables: { query: settings.inboxQuery, limit: settings.inboxLimit },
    skip: !activated,
    fetchPolicy: 'cache-and-network',
  });

  useEffect(() => {
    if (error) logger.warn('Failed to fetch Gmail threads', { error: error.message });
  }, [error, logger]);

  if (!isExpanded) return null;
  if (loading && !data) return <LoadingItem id="inbox-loading" />;

  const threads = data?.gmailThreads ?? [];
  if (threads.length === 0) {
    return <NavItem item={{ id: 'inbox-empty', label: 'No threads found', variant: 'item' }} depth={1} />;
  }

  return (
    <>
      {threads.map((thread) => (
        <NavItem
          key={`thread-${thread.id}`}
          item={{
            id: `thread-${thread.id}`,
            label: `${thread.unread ? '\u{1F535} ' : ''}${thread.subject ?? '(no subject)'}`,
            variant: 'item',
            icon: <Mail size={12} />,
            meta: <span className="text-[10px] text-muted-foreground">{formatEmailFrom(thread.from)}</span>,
          }}
          depth={1}
          onSelect={() => openEntityDrawer(`@vienna//gmail_thread/${thread.id}`)}
        />
      ))}
    </>
  );
}

function AgendaFolder({ isExpanded, activated, openEntityDrawer, logger }: FolderProps) {
  const calendarTimeMin = useMemo(() => new Date().toISOString(), []);

  const { data, loading, error } = usePluginQuery<{
    calendarEvents: Array<{
      id: string; summary?: string; start?: string; end?: string;
      startFormatted?: string; endFormatted?: string; allDay?: boolean;
      location?: string; hangoutLink?: string; htmlLink?: string;
    }>;
  }>(GET_CALENDAR_EVENTS, {
    variables: { timeMin: calendarTimeMin, limit: 15 },
    skip: !activated,
    fetchPolicy: 'cache-and-network',
  });

  useEffect(() => {
    if (error) logger.warn('Failed to fetch calendar events', { error: error.message });
  }, [error, logger]);

  if (!isExpanded) return null;
  if (loading && !data) return <LoadingItem id="agenda-loading" />;

  const events = data?.calendarEvents ?? [];
  if (events.length === 0) {
    return <NavItem item={{ id: 'agenda-empty', label: 'No upcoming events', variant: 'item' }} depth={1} />;
  }

  return (
    <>
      {events.map((event) => (
        <NavItem
          key={`event-${event.id}`}
          item={{
            id: `event-${event.id}`,
            label: event.summary ?? '(no title)',
            variant: 'item',
            icon: <Calendar size={12} />,
            meta: event.startFormatted ? <span className="text-[10px] text-muted-foreground">{event.startFormatted}</span> : undefined,
            hoverActions: event.hangoutLink ? (
              <button
                onClick={(e) => { e.stopPropagation(); openExternalUrl(event.hangoutLink!); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-background-tertiary rounded"
                title="Join meeting"
              >
                <ExternalLink size={10} />
              </button>
            ) : undefined,
          }}
          depth={1}
          onSelect={() => openEntityDrawer(`@vienna//calendar_event/${event.id}`)}
        />
      ))}
    </>
  );
}

function DocsFolder({ isExpanded, activated, openEntityDrawer, logger }: FolderProps) {
  const { data, loading, error } = usePluginQuery<{
    docsDocuments: Array<{
      id: string; name: string; mimeType: string; mimeTypeLabel?: string;
      modifiedTime?: string; ownerName?: string; webViewLink?: string;
    }>;
  }>(GET_DOCS_DOCUMENTS, {
    variables: { limit: 10 },
    skip: !activated,
    fetchPolicy: 'cache-and-network',
  });

  useEffect(() => {
    if (error) logger.warn('Failed to fetch Docs documents', { error: error.message });
  }, [error, logger]);

  if (!isExpanded) return null;
  if (loading && !data) return <LoadingItem id="docs-loading" />;

  const docs = data?.docsDocuments ?? [];
  if (docs.length === 0) {
    return <NavItem item={{ id: 'docs-empty', label: 'No recent documents', variant: 'item' }} depth={1} />;
  }

  return (
    <>
      {docs.map((doc) => (
        <NavItem
          key={`doc-${doc.id}`}
          item={{
            id: `doc-${doc.id}`,
            label: truncate(doc.name, 50),
            variant: 'item',
            icon: <FileText size={12} />,
            meta: doc.ownerName ? <span className="text-[10px] text-muted-foreground">{doc.ownerName}</span> : undefined,
            hoverActions: doc.webViewLink ? (
              <button
                onClick={(e) => { e.stopPropagation(); openExternalUrl(doc.webViewLink!); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-background-tertiary rounded"
                title="Open in Google Docs"
              >
                <ExternalLink size={10} />
              </button>
            ) : undefined,
          }}
          depth={1}
          onSelect={() => openEntityDrawer(`@vienna//docs_document/${doc.id}`)}
        />
      ))}
    </>
  );
}

function FilesFolder({ isExpanded, activated, openEntityDrawer, logger }: FolderProps) {
  const { settings } = useGoogleWorkspaceSettings();

  const driveQuery = useMemo(() => {
    const parts: string[] = [];
    if (settings.driveQuery) parts.push(settings.driveQuery);
    if (settings.driveMimeFilter && settings.driveMimeFilter !== 'all' && /^[a-zA-Z0-9.\/\-]+$/.test(settings.driveMimeFilter)) {
      parts.push(`mimeType='${settings.driveMimeFilter}'`);
    }
    return parts.length > 0 ? parts.join(' and ') : undefined;
  }, [settings.driveQuery, settings.driveMimeFilter]);

  const { data, loading, error } = usePluginQuery<{
    driveFiles: Array<{
      id: string; name: string; mimeType: string; mimeTypeLabel?: string;
      modifiedTime?: string; ownerName?: string; webViewLink?: string;
    }>;
  }>(GET_DRIVE_FILES, {
    variables: { query: driveQuery, limit: settings.driveLimit },
    skip: !activated,
    fetchPolicy: 'cache-and-network',
  });

  useEffect(() => {
    if (error) logger.warn('Failed to fetch Drive files', { error: error.message });
  }, [error, logger]);

  if (!isExpanded) return null;
  if (loading && !data) return <LoadingItem id="files-loading" />;

  const files = data?.driveFiles ?? [];
  if (files.length === 0) {
    return <NavItem item={{ id: 'files-empty', label: 'No recent files', variant: 'item' }} depth={1} />;
  }

  return (
    <>
      {files.map((file) => (
        <NavItem
          key={`file-${file.id}`}
          item={{
            id: `file-${file.id}`,
            label: truncate(file.name, 50),
            variant: 'item',
            icon: <HardDrive size={12} />,
            meta: file.mimeTypeLabel ? <span className="text-[10px] text-muted-foreground">{file.mimeTypeLabel}</span> : undefined,
            hoverActions: file.webViewLink ? (
              <button
                onClick={(e) => { e.stopPropagation(); openExternalUrl(file.webViewLink!); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-background-tertiary rounded"
                title="Open in Drive"
              >
                <ExternalLink size={10} />
              </button>
            ) : undefined,
          }}
          depth={1}
          onSelect={() => {
            const isDoc = file.mimeType === 'application/vnd.google-apps.document';
            openEntityDrawer(isDoc ? `@vienna//docs_document/${file.id}` : `@vienna//drive_file/${file.id}`);
          }}
        />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function GoogleWorkspaceNavSection({
  pluginId,
  openPluginDrawer,
  openEntityDrawer,
  hostApi,
  logger,
}: NavSidebarCanvasProps) {
  // ── Auth check ─────────────────────────────────────────────────────────
  const { data: authData, loading: authLoading } = usePluginQuery<{
    gwsAuthStatus: { authenticated: boolean; email?: string; tokenError?: string };
  }>(GET_GWS_AUTH_STATUS, {
    fetchPolicy: 'cache-and-network',
  });

  const authStatus = authData?.gwsAuthStatus;
  const isAuthenticated = authStatus?.authenticated ?? false;
  const tokenError = authStatus?.tokenError;

  // ── Folder state (persisted to localStorage) ─────────────────────────
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch {}
    return new Set<string>();
  });

  // Track which folders have ever been expanded (keeps queries alive after collapse)
  const activatedRef = useRef<Set<string>>(new Set(expandedFolders));

  const handleFolderToggle = useCallback((id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        activatedRef.current.add(id);
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const isActivated = useCallback(
    (id: string) => isAuthenticated && !authLoading && activatedRef.current.has(id),
    [isAuthenticated, authLoading],
  );

  // ── Section config ─────────────────────────────────────────────────────
  const sectionData = {
    id: `plugin-${pluginId}-nav`,
    label: 'Google Workspace',
    icon: <GoogleIcon size={12} />,
    items: [],
    isLoading: authLoading,
    hoverActions: (
      <NavHeaderActions>
        <NavSettingsButton
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            openPluginDrawer({ view: 'settings' });
          }}
          ariaLabel="Google Workspace settings"
        />
      </NavHeaderActions>
    ),
    emptyState: !isAuthenticated
      ? (tokenError ? 'Token expired — run `gws auth login`' : 'Run `gws auth login` to connect')
      : 'No items to show',
  };

  // ── Unauthenticated state ──────────────────────────────────────────────
  if (!authLoading && !isAuthenticated) {
    const isExpired = !!tokenError;
    return (
      <NavSection section={sectionData} defaultExpanded>
        <NavItem
          item={{
            id: 'auth-error',
            label: isExpired ? 'Token expired — re-authenticate' : 'Not connected',
            variant: 'item',
            icon: <Settings size={14} />,
          }}
          onSelect={() => openPluginDrawer({ view: 'settings' })}
        />
      </NavSection>
    );
  }

  // ── Authenticated state ────────────────────────────────────────────────
  const inboxExpanded = expandedFolders.has('inbox');
  const agendaExpanded = expandedFolders.has('agenda');
  const docsExpanded = expandedFolders.has('docs');
  const filesExpanded = expandedFolders.has('files');

  return (
    <NavSection section={sectionData} defaultExpanded>
      <NavItem
        item={{ id: 'inbox', label: 'Inbox', variant: 'folder', icon: <Mail size={14} /> }}
        isExpanded={inboxExpanded}
        onToggle={handleFolderToggle}
      >
        <InboxFolder isExpanded={inboxExpanded} activated={isActivated('inbox')} openEntityDrawer={openEntityDrawer} logger={logger} />
      </NavItem>

      <NavItem
        item={{ id: 'agenda', label: 'Agenda', variant: 'folder', icon: <Calendar size={14} /> }}
        isExpanded={agendaExpanded}
        onToggle={handleFolderToggle}
      >
        <AgendaFolder isExpanded={agendaExpanded} activated={isActivated('agenda')} openEntityDrawer={openEntityDrawer} logger={logger} />
      </NavItem>

      <NavItem
        item={{ id: 'docs', label: 'Docs', variant: 'folder', icon: <FileText size={14} /> }}
        isExpanded={docsExpanded}
        onToggle={handleFolderToggle}
      >
        <DocsFolder isExpanded={docsExpanded} activated={isActivated('docs')} openEntityDrawer={openEntityDrawer} logger={logger} />
      </NavItem>

      <NavItem
        item={{ id: 'files', label: 'Recent Files', variant: 'folder', icon: <HardDrive size={14} /> }}
        isExpanded={filesExpanded}
        onToggle={handleFolderToggle}
      >
        <FilesFolder isExpanded={filesExpanded} activated={isActivated('files')} openEntityDrawer={openEntityDrawer} logger={logger} />
      </NavItem>
    </NavSection>
  );
}
