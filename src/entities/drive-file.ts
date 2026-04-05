import { defineEntity } from '@tryvienna/sdk';
import { DRIVE_FILE_URI_SEGMENTS } from './uri';
import { DriveFileDrawer } from '../ui/DriveFileDrawer';

const DRIVE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>';

export const driveFileEntity = defineEntity({
  type: 'drive_file',
  name: 'Drive File',
  description: 'A file from Google Drive',
  icon: { svg: DRIVE_SVG },
  source: 'integration',
  uri: [...DRIVE_FILE_URI_SEGMENTS],

  display: {
    emoji: '\uD83D\uDCC4',
    colors: { bg: '#0F9D58', text: '#FFFFFF', border: '#0B8043' },
    description: 'Google Drive files and documents',
    outputFields: [
      { key: 'name', label: 'Name', metadataPath: 'name' },
      { key: 'mimeType', label: 'Type', metadataPath: 'mimeTypeLabel' },
      { key: 'modifiedTime', label: 'Modified', metadataPath: 'modifiedTime' },
      { key: 'owner', label: 'Owner', metadataPath: 'ownerName' },
      { key: 'url', label: 'URL', metadataPath: 'webViewLink' },
    ],
  },

  cache: { ttl: 60_000, maxSize: 200 },
  ui: { drawer: DriveFileDrawer },
});
