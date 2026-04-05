/**
 * Mock data for Storybook stories.
 */

import type { SuggestionCardData } from '../docs/suggestions/SuggestionCard';

// ── Mock Suggestions ────────────────────────────────────────────────────────

export const mockSuggestions: SuggestionCardData[] = [
  {
    id: 'sug_1',
    description: 'Sharpen the opening paragraph for clarity',
    rationale:
      'The current opening uses passive voice and buries the key insight. Leading with the main finding makes the document more impactful.',
    category: 'clarity',
    parts: [
      {
        id: 'part_1a',
        changeType: 'replace',
        original:
          'It was determined through our analysis that the system performance has been significantly impacted by the recent changes.',
        proposed:
          'Our analysis shows the recent changes cut system performance by 40%.',
      },
    ],
  },
  {
    id: 'sug_2',
    description: 'Fix grammatical error in section 2',
    category: 'content',
    parts: [
      {
        id: 'part_2a',
        changeType: 'replace',
        original: 'The team have been working on this since last month.',
        proposed: 'The team has been working on this since last month.',
      },
    ],
  },
  {
    id: 'sug_3',
    description: 'Remove redundant paragraph about deployment',
    rationale:
      'This paragraph repeats information already covered in the Deployment Strategy section above.',
    category: 'structure',
    parts: [
      {
        id: 'part_3a',
        changeType: 'delete',
        original:
          'The deployment process involves pushing to staging first, then production. We use a blue-green deployment strategy to minimize downtime.',
        proposed: null,
      },
    ],
  },
  {
    id: 'sug_4',
    description: 'Add missing context about the API rate limits',
    category: 'content',
    parts: [
      {
        id: 'part_4a',
        changeType: 'replace',
        original: 'The API supports up to 1000 requests per minute.',
        proposed:
          'The API supports up to 1000 requests per minute. Exceeding this limit returns a 429 status code with a Retry-After header indicating when requests can resume.',
      },
    ],
  },
];

export const singleSuggestion: SuggestionCardData = mockSuggestions[0];

export const multiPartSuggestion: SuggestionCardData = {
  id: 'sug_multi',
  description: 'Improve consistency across the requirements section',
  rationale: 'Several bullet points use inconsistent verb forms. Standardizing to imperative mood improves scannability.',
  category: 'clarity',
  parts: [
    {
      id: 'part_m1',
      changeType: 'replace',
      original: 'Users should be able to log in with SSO',
      proposed: 'Support SSO login',
    },
    {
      id: 'part_m2',
      changeType: 'replace',
      original: 'The system needs to handle concurrent requests',
      proposed: 'Handle concurrent requests',
    },
    {
      id: 'part_m3',
      changeType: 'replace',
      original: 'It would be good if we had audit logging',
      proposed: 'Implement audit logging',
    },
  ],
};

// ── Mock Gmail Threads ──────────────────────────────────────────────────────

export const mockGmailThreads = [
  {
    id: 'thread_1',
    subject: 'Q3 Planning — Action Items',
    from: 'Sarah Chen <sarah@company.com>',
    date: '2026-03-30T10:15:00Z',
    snippet: 'Hi team, following up on our planning session...',
    unread: true,
    messageCount: 4,
  },
  {
    id: 'thread_2',
    subject: 'Re: API Design Review',
    from: 'Marcus Johnson <marcus@company.com>',
    date: '2026-03-29T16:45:00Z',
    snippet: 'Looks good! One comment on the auth endpoint...',
    unread: true,
    messageCount: 7,
  },
  {
    id: 'thread_3',
    subject: 'Weekly Standup Notes — March 28',
    from: 'Team Bot <bot@company.com>',
    date: '2026-03-28T09:00:00Z',
    snippet: 'Automated standup summary for the week...',
    unread: false,
    messageCount: 1,
  },
  {
    id: 'thread_4',
    subject: 'Invitation: Product Demo @ Thu Mar 30',
    from: 'Google Calendar <calendar@google.com>',
    date: '2026-03-27T14:30:00Z',
    snippet: 'You have been invited to a meeting...',
    unread: false,
    messageCount: 2,
  },
];

// ── Mock Calendar Events ────────────────────────────────────────────────────

export const mockCalendarEvents = [
  {
    id: 'event_1',
    summary: 'Team Standup',
    start: '2026-03-30T09:00:00Z',
    end: '2026-03-30T09:15:00Z',
    startFormatted: '9:00 AM',
    endFormatted: '9:15 AM',
    allDay: false,
    hangoutLink: 'https://meet.google.com/abc-defg-hij',
  },
  {
    id: 'event_2',
    summary: 'Product Demo',
    start: '2026-03-30T14:00:00Z',
    end: '2026-03-30T15:00:00Z',
    startFormatted: '2:00 PM',
    endFormatted: '3:00 PM',
    allDay: false,
    location: 'Conference Room B',
  },
  {
    id: 'event_3',
    summary: '1:1 with Sarah',
    start: '2026-03-30T16:00:00Z',
    end: '2026-03-30T16:30:00Z',
    startFormatted: '4:00 PM',
    endFormatted: '4:30 PM',
    allDay: false,
    hangoutLink: 'https://meet.google.com/xyz-uvwx-rst',
  },
  {
    id: 'event_4',
    summary: 'Company All-Hands',
    start: '2026-03-31T00:00:00Z',
    end: '2026-04-01T00:00:00Z',
    startFormatted: 'All day',
    allDay: true,
  },
];

// ── Mock Drive Files ────────────────────────────────────────────────────────

export const mockDriveFiles = [
  {
    id: 'file_1',
    name: 'Q3 Product Roadmap',
    mimeType: 'application/vnd.google-apps.document',
    mimeTypeLabel: 'Google Doc',
    modifiedTime: '2026-03-30T08:22:00Z',
    ownerName: 'Will',
    webViewLink: '#',
  },
  {
    id: 'file_2',
    name: 'Revenue Forecast 2026',
    mimeType: 'application/vnd.google-apps.spreadsheet',
    mimeTypeLabel: 'Google Sheet',
    modifiedTime: '2026-03-29T12:00:00Z',
    ownerName: 'Finance Team',
    webViewLink: '#',
  },
  {
    id: 'file_3',
    name: 'Brand Guidelines v3',
    mimeType: 'application/vnd.google-apps.presentation',
    mimeTypeLabel: 'Google Slides',
    modifiedTime: '2026-03-28T15:30:00Z',
    ownerName: 'Design',
    webViewLink: '#',
  },
  {
    id: 'file_4',
    name: 'Architecture Diagram.png',
    mimeType: 'image/png',
    mimeTypeLabel: 'Image',
    modifiedTime: '2026-03-27T09:00:00Z',
    ownerName: 'Will',
    webViewLink: '#',
  },
];

// ── Mock Google Docs ────────────────────────────────────────────────────────

export const mockDocsDocuments = [
  {
    id: 'doc_1',
    name: 'Q3 Product Roadmap',
    mimeType: 'application/vnd.google-apps.document',
    mimeTypeLabel: 'Google Doc',
    modifiedTime: '2026-03-30T08:22:00Z',
    ownerName: 'Will',
    webViewLink: '#',
  },
  {
    id: 'doc_2',
    name: 'API Design Spec — v2',
    mimeType: 'application/vnd.google-apps.document',
    mimeTypeLabel: 'Google Doc',
    modifiedTime: '2026-03-29T14:00:00Z',
    ownerName: 'Marcus',
    webViewLink: '#',
  },
  {
    id: 'doc_3',
    name: 'Meeting Notes — Product Sync',
    mimeType: 'application/vnd.google-apps.document',
    mimeTypeLabel: 'Google Doc',
    modifiedTime: '2026-03-28T11:00:00Z',
    ownerName: 'Sarah',
    webViewLink: '#',
  },
];
