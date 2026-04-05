/**
 * CalendarEventDrawer — Entity drawer for Google Calendar events.
 *
 * Shows event summary, time, location, attendees, and description.
 * Registered on the calendar_event entity via `ui: { drawer }`.
 */

import {
  DrawerBody,
  DrawerPanelFooter,
  Separator,
  Button,
  Badge,
  Markdown,
} from '@tryvienna/ui';
import { ExternalLink, MapPin, Clock, Video, Calendar } from 'lucide-react';
import { parseEntityURI } from '@tryvienna/sdk';
import { usePluginQuery } from '@tryvienna/sdk/react';
import type { EntityDrawerProps } from '@tryvienna/sdk';
import { CALENDAR_EVENT_URI_PATH } from '../entities/uri';
import { GET_CALENDAR_EVENT } from '../client/operations';
import { formatRelative } from '../helpers';
import { openExternalUrl } from '../openExternal';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function MetadataRow({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {icon && <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>}
      <div className="flex-1">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className="text-xs font-medium text-foreground">{children}</div>
      </div>
    </div>
  );
}

const RESPONSE_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  accepted: { bg: 'bg-green-500/10', text: 'text-green-600 dark:text-green-400', label: 'Accepted' },
  declined: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', label: 'Declined' },
  tentative: { bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', label: 'Maybe' },
  needsAction: { bg: 'bg-gray-500/10', text: 'text-muted-foreground', label: 'Pending' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Drawer
// ─────────────────────────────────────────────────────────────────────────────

export function CalendarEventDrawer({ uri, headerActions, DrawerContainer }: EntityDrawerProps) {
  const { id } = parseEntityURI(uri, CALENDAR_EVENT_URI_PATH);
  const eventId = id['eventId'] ?? '';

  const { data, loading, error } = usePluginQuery<{
    calendarEvent: {
      id: string;
      summary?: string;
      description?: string;
      location?: string;
      start?: string;
      end?: string;
      startFormatted?: string;
      endFormatted?: string;
      allDay?: boolean;
      status?: string;
      htmlLink?: string;
      organizer?: string;
      hangoutLink?: string;
      attendeeNames?: string;
      createdAt?: string;
      updatedAt?: string;
      attendees?: Array<{
        email: string;
        displayName?: string;
        responseStatus?: string;
        self?: boolean;
      }>;
    };
  }>(GET_CALENDAR_EVENT, {
    variables: { eventId },
    fetchPolicy: 'cache-and-network',
    skip: !eventId,
  });

  const event = data?.calendarEvent;

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading && !event) {
    return (
      <DrawerContainer title="Calendar Event">
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

  if (error || !event) {
    return (
      <DrawerContainer title="Calendar Event">
        <DrawerBody>
          <div className="flex flex-col items-center gap-2 py-8">
            <span className="text-sm text-muted-foreground">
              {error ? 'Failed to load event' : 'Event not found'}
            </span>
          </div>
        </DrawerBody>
      </DrawerContainer>
    );
  }

  const attendees = event.attendees ?? [];

  return (
    <DrawerContainer
      title={event.summary ?? '(no title)'}
      headerActions={headerActions}
      footer={
        <DrawerPanelFooter>
          <div className="flex items-center gap-2">
            {event.htmlLink && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openExternalUrl(event.htmlLink!)}
              >
                <ExternalLink size={12} className="mr-1" />
                Open in Calendar
              </Button>
            )}
            {event.hangoutLink && (
              <Button
                variant="default"
                size="sm"
                onClick={() => openExternalUrl(event.hangoutLink!)}
              >
                <Video size={12} className="mr-1" />
                Join Meeting
              </Button>
            )}
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
              style={{ backgroundColor: '#4285F420', borderColor: '#4285F4' }}
            >
              <Calendar size={10} className="mr-1" />
              Calendar
            </Badge>
            {event.allDay && (
              <Badge variant="outline" className="text-[10px]">All day</Badge>
            )}
            {event.status && event.status !== 'confirmed' && (
              <Badge variant="outline" className="text-[10px] capitalize">{event.status}</Badge>
            )}
          </div>

          {/* Time */}
          <div className="space-y-1">
            {event.startFormatted && (
              <MetadataRow label="Start" icon={<Clock size={12} />}>
                {event.startFormatted}
              </MetadataRow>
            )}
            {event.endFormatted && (
              <MetadataRow label="End" icon={<Clock size={12} />}>
                {event.endFormatted}
              </MetadataRow>
            )}
            {event.location && (
              <MetadataRow label="Location" icon={<MapPin size={12} />}>
                {event.location}
              </MetadataRow>
            )}
            {event.organizer && (
              <MetadataRow label="Organizer">
                {event.organizer}
              </MetadataRow>
            )}
            {event.hangoutLink && (
              <MetadataRow label="Meeting" icon={<Video size={12} />}>
                <button
                  onClick={() => openExternalUrl(event.hangoutLink!)}
                  className="text-primary hover:underline"
                >
                  Join video call
                </button>
              </MetadataRow>
            )}
          </div>

          {/* Attendees */}
          {attendees.length > 0 && (
            <>
              <Separator />
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-2 block">
                  Attendees ({attendees.length})
                </span>
                <div className="space-y-1">
                  {attendees.map((attendee) => {
                    const status = RESPONSE_STATUS_COLORS[attendee.responseStatus ?? 'needsAction'] ?? RESPONSE_STATUS_COLORS.needsAction;
                    return (
                      <div
                        key={attendee.email}
                        className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs">
                            {attendee.displayName ?? attendee.email}
                          </span>
                          {attendee.self && (
                            <Badge variant="outline" className="text-[9px] h-4">You</Badge>
                          )}
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                          {status.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Description */}
          {event.description && (
            <>
              <Separator />
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-2 block">Description</span>
                <div className="rounded border border-border p-3">
                  <Markdown content={event.description} size="sm" />
                </div>
              </div>
            </>
          )}

          {/* Timestamps */}
          {(event.createdAt || event.updatedAt) && (
            <>
              <Separator />
              <div className="space-y-1">
                {event.createdAt && <MetadataRow label="Created">{formatRelative(event.createdAt)}</MetadataRow>}
                {event.updatedAt && <MetadataRow label="Updated">{formatRelative(event.updatedAt)}</MetadataRow>}
              </div>
            </>
          )}
        </div>
      </DrawerBody>
    </DrawerContainer>
  );
}
