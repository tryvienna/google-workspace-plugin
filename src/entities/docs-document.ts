import { defineEntity } from '@tryvienna/sdk';
import { DOCS_DOCUMENT_URI_SEGMENTS } from './uri';
import { DocsDocumentDrawer } from '../ui/DocsDocumentDrawer';

const DOCS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>';

export const docsDocumentEntity = defineEntity({
  type: 'docs_document',
  name: 'Google Doc',
  description: 'A Google Docs document',
  icon: { svg: DOCS_SVG },
  source: 'integration',
  uri: [...DOCS_DOCUMENT_URI_SEGMENTS],

  display: {
    emoji: '\uD83D\uDCD1',
    colors: { bg: '#4285F4', text: '#FFFFFF', border: '#3367D6' },
    description: 'Google Docs documents',
    outputFields: [
      { key: 'title', label: 'Title', metadataPath: 'title' },
      { key: 'owner', label: 'Owner', metadataPath: 'ownerName' },
      { key: 'modified', label: 'Modified', metadataPath: 'modifiedTime' },
    ],
  },

  cache: { ttl: 60_000, maxSize: 100 },
  ui: { drawer: DocsDocumentDrawer },
});
