import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { useState, useCallback } from 'react';
import {
  NavSection,
  NavItem,
  NavSettingsButton,
  NavHeaderActions,
} from '@tryvienna/ui';
import { Mail, Calendar, HardDrive, FileText, Settings, ExternalLink } from 'lucide-react';
import {
  mockGmailThreads,
  mockCalendarEvents,
  mockDriveFiles,
  mockDocsDocuments,
} from './mock-data';

/**
 * Standalone Nav Section demo showing all four folders:
 * Inbox, Agenda, Docs, Recent Files.
 */

function formatEmailFrom(from: string): string {
  const match = from.match(/^([^<]+)/);
  return match ? match[1].trim() : from;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}

function NavSectionDemo() {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(['inbox', 'agenda', 'docs', 'files']),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleFolderToggle = useCallback((id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const sectionData = {
    id: 'plugin-google_workspace-nav',
    label: 'Google Workspace',
    icon: <Mail size={12} />,
    items: [],
  };

  return (
    <div className="w-[280px] border border-border rounded-lg bg-background overflow-hidden">
      <NavSection
        section={sectionData}
        defaultExpanded
      >
        {/* Inbox */}
        <NavItem
          item={{
            id: 'inbox',
            label: `Inbox (${mockGmailThreads.length})`,
            variant: 'folder',
            icon: <Mail size={14} />,
          }}
          isExpanded={expandedFolders.has('inbox')}
          onToggle={handleFolderToggle}
        >
          {expandedFolders.has('inbox') &&
            mockGmailThreads.map((thread) => (
              <NavItem
                key={`thread-${thread.id}`}
                item={{
                  id: `thread-${thread.id}`,
                  label: `${thread.unread ? '\u{1F535} ' : ''}${thread.subject}`,
                  variant: 'item',
                  icon: <Mail size={12} />,
                  meta: (
                    <span className="text-[10px] text-muted-foreground">
                      {formatEmailFrom(thread.from)}
                    </span>
                  ),
                }}
                depth={1}
                onSelect={() => setSelectedId(thread.id)}
              />
            ))}
        </NavItem>

        {/* Agenda */}
        <NavItem
          item={{
            id: 'agenda',
            label: `Agenda (${mockCalendarEvents.length})`,
            variant: 'folder',
            icon: <Calendar size={14} />,
          }}
          isExpanded={expandedFolders.has('agenda')}
          onToggle={handleFolderToggle}
        >
          {expandedFolders.has('agenda') &&
            mockCalendarEvents.map((event) => (
              <NavItem
                key={`event-${event.id}`}
                item={{
                  id: `event-${event.id}`,
                  label: event.summary,
                  variant: 'item',
                  icon: <Calendar size={12} />,
                  meta: event.startFormatted ? (
                    <span className="text-[10px] text-muted-foreground">
                      {event.startFormatted}
                    </span>
                  ) : undefined,
                  hoverActions: event.hangoutLink ? (
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-background-tertiary rounded"
                      title="Join meeting"
                    >
                      <ExternalLink size={10} />
                    </a>
                  ) : undefined,
                }}
                depth={1}
                onSelect={() => setSelectedId(event.id)}
              />
            ))}
        </NavItem>

        {/* Docs */}
        <NavItem
          item={{
            id: 'docs',
            label: `Docs (${mockDocsDocuments.length})`,
            variant: 'folder',
            icon: <FileText size={14} />,
          }}
          isExpanded={expandedFolders.has('docs')}
          onToggle={handleFolderToggle}
        >
          {expandedFolders.has('docs') &&
            mockDocsDocuments.map((doc) => (
              <NavItem
                key={`doc-${doc.id}`}
                item={{
                  id: `doc-${doc.id}`,
                  label: truncate(doc.name, 50),
                  variant: 'item',
                  icon: <FileText size={12} />,
                  meta: doc.ownerName ? (
                    <span className="text-[10px] text-muted-foreground">
                      {doc.ownerName}
                    </span>
                  ) : undefined,
                }}
                depth={1}
                onSelect={() => setSelectedId(doc.id)}
              />
            ))}
        </NavItem>

        {/* Recent Files */}
        <NavItem
          item={{
            id: 'files',
            label: `Recent Files (${mockDriveFiles.length})`,
            variant: 'folder',
            icon: <HardDrive size={14} />,
          }}
          isExpanded={expandedFolders.has('files')}
          onToggle={handleFolderToggle}
        >
          {expandedFolders.has('files') &&
            mockDriveFiles.map((file) => (
              <NavItem
                key={`file-${file.id}`}
                item={{
                  id: `file-${file.id}`,
                  label: truncate(file.name, 50),
                  variant: 'item',
                  icon: <HardDrive size={12} />,
                  meta: file.mimeTypeLabel ? (
                    <span className="text-[10px] text-muted-foreground">
                      {file.mimeTypeLabel}
                    </span>
                  ) : undefined,
                }}
                depth={1}
                onSelect={() => setSelectedId(file.id)}
              />
            ))}
        </NavItem>
      </NavSection>

      {selectedId && (
        <div className="px-3 py-2 border-t border-border text-[11px] text-muted-foreground">
          Selected: {selectedId}
        </div>
      )}
    </div>
  );
}

function UnauthenticatedDemo() {
  const sectionData = {
    id: 'plugin-google_workspace-nav',
    label: 'Google Workspace',
    icon: <Mail size={12} />,
    items: [],
    emptyState: 'Run `gws auth login` to connect',
    hoverActions: (
      <NavHeaderActions>
        <NavSettingsButton
          onClick={fn()}
          ariaLabel="Google Workspace settings"
        />
      </NavHeaderActions>
    ),
  };

  return (
    <div className="w-[280px] border border-border rounded-lg bg-background overflow-hidden">
      <NavSection section={sectionData} defaultExpanded>
        <NavItem
          item={{
            id: 'auth-error',
            label: 'Not connected',
            variant: 'item',
            icon: <Settings size={14} />,
          }}
          onSelect={fn()}
        />
      </NavSection>
    </div>
  );
}

const meta = {
  title: 'Navigation/Sidebar',
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Authenticated: Story = {
  render: () => <NavSectionDemo />,
};

export const Unauthenticated: Story = {
  render: () => <UnauthenticatedDemo />,
};
