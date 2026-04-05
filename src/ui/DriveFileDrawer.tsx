/**
 * DriveFileDrawer — Entity drawer for Google Drive files.
 *
 * Shows file name, type, size, owner, dates, and action links.
 * Registered on the drive_file entity via `ui: { drawer }`.
 */

import {
  DrawerBody,
  DrawerPanelFooter,
  Separator,
  Button,
  Badge,
} from '@tryvienna/ui';
import { ExternalLink, Download, Star, Share2, FileText } from 'lucide-react';
import { parseEntityURI } from '@tryvienna/sdk';
import { usePluginQuery } from '@tryvienna/sdk/react';
import type { EntityDrawerProps } from '@tryvienna/sdk';
import { DRIVE_FILE_URI_PATH } from '../entities/uri';
import { GET_DRIVE_FILE } from '../client/operations';
import { formatRelative } from '../helpers';
import { DocsViewer } from './DocsViewer';
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

function formatFileSize(sizeStr: string | null | undefined): string {
  if (!sizeStr) return 'Unknown';
  const bytes = parseInt(sizeStr, 10);
  if (isNaN(bytes)) return sizeStr;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Drawer
// ─────────────────────────────────────────────────────────────────────────────

export function DriveFileDrawer({ uri, headerActions, DrawerContainer }: EntityDrawerProps) {
  const { id } = parseEntityURI(uri, DRIVE_FILE_URI_PATH);
  const fileId = id['fileId'] ?? '';

  const { data, loading, error } = usePluginQuery<{
    driveFile: {
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
      starred?: boolean;
      shared?: boolean;
    };
  }>(GET_DRIVE_FILE, {
    variables: { fileId },
    fetchPolicy: 'cache-and-network',
    skip: !fileId,
  });

  const file = data?.driveFile;

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading && !file) {
    return (
      <DrawerContainer title="Drive File">
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

  if (error || !file) {
    return (
      <DrawerContainer title="Drive File">
        <DrawerBody>
          <div className="flex flex-col items-center gap-2 py-8">
            <span className="text-sm text-muted-foreground">
              {error ? 'Failed to load file' : 'File not found'}
            </span>
          </div>
        </DrawerBody>
      </DrawerContainer>
    );
  }

  const isGoogleDoc = file.mimeType === 'application/vnd.google-apps.document';

  return (
    <DrawerContainer
      title={file.name}
      headerActions={headerActions}
      footer={
        <DrawerPanelFooter>
          <div className="flex items-center gap-2">
            {file.webViewLink && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openExternalUrl(file.webViewLink!)}
              >
                <ExternalLink size={12} className="mr-1" />
                {isGoogleDoc ? 'Open in Docs' : 'Open in Drive'}
              </Button>
            )}
            {file.webContentLink && !isGoogleDoc && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openExternalUrl(file.webContentLink!)}
              >
                <Download size={12} className="mr-1" />
                Download
              </Button>
            )}
          </div>
        </DrawerPanelFooter>
      }
    >
      {isGoogleDoc ? (
        <DocsViewer documentId={fileId} />
      ) : (
      <DrawerBody>
        <div className="space-y-4">
          {/* Header badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="text-[10px]"
              style={{ backgroundColor: '#0F9D5820', borderColor: '#0F9D58' }}
            >
              <FileText size={10} className="mr-1" />
              {file.mimeTypeLabel ?? 'File'}
            </Badge>
            {file.starred && (
              <Badge variant="outline" className="text-[10px]">
                <Star size={10} className="mr-1 fill-yellow-400 text-yellow-400" />
                Starred
              </Badge>
            )}
            {file.shared && (
              <Badge variant="outline" className="text-[10px]">
                <Share2 size={10} className="mr-1" />
                Shared
              </Badge>
            )}
          </div>

          <Separator />

          {/* Metadata */}
          <div className="space-y-1">
            <MetadataRow label="Type">{file.mimeTypeLabel ?? file.mimeType}</MetadataRow>
            {file.size && <MetadataRow label="Size">{formatFileSize(file.size)}</MetadataRow>}
            {file.ownerName && <MetadataRow label="Owner">{file.ownerName}</MetadataRow>}
            {file.ownerEmail && !file.ownerName && (
              <MetadataRow label="Owner">{file.ownerEmail}</MetadataRow>
            )}
            {file.modifiedTime && (
              <MetadataRow label="Modified">{formatRelative(file.modifiedTime)}</MetadataRow>
            )}
            {file.createdTime && (
              <MetadataRow label="Created">{formatRelative(file.createdTime)}</MetadataRow>
            )}
          </div>
        </div>
      </DrawerBody>
      )}
    </DrawerContainer>
  );
}
