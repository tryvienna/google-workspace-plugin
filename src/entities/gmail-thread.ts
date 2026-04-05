import { defineEntity } from '@tryvienna/sdk';
import { GMAIL_THREAD_URI_SEGMENTS } from './uri';
import { GmailThreadDrawer } from '../ui/GmailThreadDrawer';

const GMAIL_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>';

export const gmailThreadEntity = defineEntity({
  type: 'gmail_thread',
  name: 'Gmail Thread',
  description: 'An email thread from Gmail',
  icon: { svg: GMAIL_SVG },
  source: 'integration',
  uri: [...GMAIL_THREAD_URI_SEGMENTS],

  display: {
    emoji: '\u2709\uFE0F',
    colors: { bg: '#EA4335', text: '#FFFFFF', border: '#D93025' },
    description: 'Gmail email threads',
    outputFields: [
      { key: 'subject', label: 'Subject', metadataPath: 'subject' },
      { key: 'from', label: 'From', metadataPath: 'from' },
      { key: 'date', label: 'Date', metadataPath: 'date' },
      { key: 'snippet', label: 'Preview', metadataPath: 'snippet' },
    ],
  },

  cache: { ttl: 30_000, maxSize: 200 },
  ui: { drawer: GmailThreadDrawer },
});
