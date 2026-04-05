import { defineEntity } from '@tryvienna/sdk';
import { CALENDAR_EVENT_URI_SEGMENTS } from './uri';
import { CalendarEventDrawer } from '../ui/CalendarEventDrawer';

const CALENDAR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';

export const calendarEventEntity = defineEntity({
  type: 'calendar_event',
  name: 'Calendar Event',
  description: 'An event from Google Calendar',
  icon: { svg: CALENDAR_SVG },
  source: 'integration',
  uri: [...CALENDAR_EVENT_URI_SEGMENTS],

  display: {
    emoji: '\uD83D\uDCC5',
    colors: { bg: '#4285F4', text: '#FFFFFF', border: '#3367D6' },
    description: 'Google Calendar events',
    outputFields: [
      { key: 'summary', label: 'Summary', metadataPath: 'summary' },
      { key: 'start', label: 'Start', metadataPath: 'startFormatted' },
      { key: 'end', label: 'End', metadataPath: 'endFormatted' },
      { key: 'location', label: 'Location', metadataPath: 'location' },
      { key: 'attendees', label: 'Attendees', metadataPath: 'attendeeNames' },
    ],
  },

  cache: { ttl: 60_000, maxSize: 100 },
  ui: { drawer: CalendarEventDrawer },
});
