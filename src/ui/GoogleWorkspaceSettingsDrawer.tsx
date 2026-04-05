/**
 * GoogleWorkspaceSettingsDrawer — Settings panel for the Google Workspace plugin.
 *
 * Since auth is delegated to `gws auth login`, this drawer shows auth status
 * and display preferences rather than credential management.
 */

import { useCallback } from 'react';
import { usePluginQuery } from '@tryvienna/sdk/react';
import {
  ContentSection,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Button,
  Input,
  Label,
} from '@tryvienna/ui';
import type { PluginHostApi, CanvasLogger } from '@tryvienna/sdk';
import { Check, X, RefreshCw, Terminal } from 'lucide-react';
import { useGoogleWorkspaceSettings } from './useGoogleWorkspaceSettings';
import { GET_GWS_AUTH_STATUS } from '../client/operations';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const AGENDA_RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: '7days', label: 'Next 7 days' },
];

const MIME_FILTER_OPTIONS = [
  { value: 'all', label: 'All files' },
  { value: 'application/vnd.google-apps.document', label: 'Google Docs' },
  { value: 'application/vnd.google-apps.spreadsheet', label: 'Google Sheets' },
  { value: 'application/vnd.google-apps.presentation', label: 'Google Slides' },
  { value: 'application/vnd.google-apps.folder', label: 'Folders' },
  { value: 'application/pdf', label: 'PDFs' },
];

const LIMIT_OPTIONS = [10, 20, 50];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function GoogleWorkspaceSettingsDrawer({
  hostApi,
  logger,
}: {
  hostApi: PluginHostApi;
  logger: CanvasLogger;
}) {
  const { settings, updateSettings, resetSettings } = useGoogleWorkspaceSettings();

  // ── Auth status ────────────────────────────────────────────────────────
  const { data: authData, loading: authLoading, refetch: refetchAuth } = usePluginQuery<{
    gwsAuthStatus: { authenticated: boolean; email?: string; tokenError?: string };
  }>(GET_GWS_AUTH_STATUS, {
    fetchPolicy: 'network-only',
  });

  const auth = authData?.gwsAuthStatus;
  const isAuthenticated = auth?.authenticated ?? false;
  const tokenError = auth?.tokenError;

  const handleRefreshAuth = useCallback(() => {
    refetchAuth();
  }, [refetchAuth]);

  return (
    <div className="space-y-4">
      {/* Authentication Status */}
      <ContentSection title="Authentication">
        <div className="space-y-2">
          {authLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
              <RefreshCw size={14} className="text-muted-foreground animate-spin" />
              <span className="text-xs text-muted-foreground">Checking authentication...</span>
            </div>
          ) : isAuthenticated ? (
            <div className="flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/5 p-3">
              <div className="flex items-center gap-2">
                <Check size={14} className="text-green-600 dark:text-green-400" />
                <div>
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    Connected
                  </span>
                  {auth?.email && (
                    <span className="text-[11px] text-muted-foreground ml-2">{auth.email}</span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleRefreshAuth}>
                <RefreshCw size={12} />
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <div className="flex items-center gap-2">
                  <X size={14} className="text-destructive" />
                  <div>
                    <span className="text-xs font-medium text-destructive">
                      {tokenError ? 'Token expired' : 'Not connected'}
                    </span>
                    {tokenError && (
                      <p className="text-[10px] text-destructive/70 mt-0.5">{tokenError}</p>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleRefreshAuth}>
                  <RefreshCw size={12} />
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Terminal size={14} className="text-muted-foreground" />
                  <span className="text-xs font-medium">
                    {tokenError ? 'Re-authenticate' : 'Setup Instructions'}
                  </span>
                </div>
                {tokenError ? (
                  <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Open your terminal</li>
                    <li>Run: <code className="bg-muted px-1 rounded">gws auth login</code></li>
                    <li>Follow the browser prompts to re-authenticate</li>
                    <li>Click refresh above to verify</li>
                  </ol>
                ) : (
                  <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Install the gws CLI: <code className="bg-muted px-1 rounded">npm i -g @googleworkspace/cli</code></li>
                    <li>Run: <code className="bg-muted px-1 rounded">gws auth login</code></li>
                    <li>Follow the browser prompts to authenticate</li>
                    <li>Click refresh above to verify</li>
                  </ol>
                )}
              </div>
            </div>
          )}
        </div>
      </ContentSection>

      {/* Inbox Settings */}
      <ContentSection title="Inbox">
        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-1 block">Search query</Label>
            <Input
              value={settings.inboxQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ inboxQuery: e.target.value })}
              placeholder="is:unread"
              className="h-7 text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Gmail search syntax (e.g. &quot;is:unread&quot;, &quot;from:alice@&quot;, &quot;label:important&quot;)
            </p>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Max threads</Label>
            <Select
              value={String(settings.inboxLimit)}
              onValueChange={(v) => updateSettings({ inboxLimit: Number(v) })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIMIT_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </ContentSection>

      {/* Agenda Settings */}
      <ContentSection title="Agenda">
        <div>
          <Label className="text-xs mb-1 block">Time range</Label>
          <Select
            value={settings.agendaRange}
            onValueChange={(v) => updateSettings({ agendaRange: v as GoogleWorkspaceSettings['agendaRange'] })}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGENDA_RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ContentSection>

      {/* Drive Settings */}
      <ContentSection title="Drive">
        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-1 block">File type filter</Label>
            <Select
              value={settings.driveMimeFilter}
              onValueChange={(v) => updateSettings({ driveMimeFilter: v })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MIME_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Max files</Label>
            <Select
              value={String(settings.driveLimit)}
              onValueChange={(v) => updateSettings({ driveLimit: Number(v) })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIMIT_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </ContentSection>

      {/* Reset */}
      <ContentSection>
        <Button variant="outline" size="sm" onClick={resetSettings} className="w-full">
          Reset to defaults
        </Button>
        <p className="text-[11px] text-muted-foreground mt-2 text-center">
          Settings are saved automatically
        </p>
      </ContentSection>
    </div>
  );
}

type GoogleWorkspaceSettings = import('./useGoogleWorkspaceSettings').GoogleWorkspaceSettings;
