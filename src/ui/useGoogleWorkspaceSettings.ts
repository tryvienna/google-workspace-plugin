/**
 * useGoogleWorkspaceSettings — Persistent settings for the Google Workspace plugin.
 *
 * Settings are stored in localStorage, scoped to the plugin.
 * Uses CustomEvent for cross-component synchronization (nav <-> settings drawer).
 */

import { useState, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GoogleWorkspaceSettings {
  /** Gmail search query filter */
  inboxQuery: string;
  /** Max threads in nav */
  inboxLimit: number;
  /** Agenda time range */
  agendaRange: 'today' | 'week' | '7days';
  /** Drive search query */
  driveQuery: string;
  /** Max files in nav */
  driveLimit: number;
  /** MIME type filter for Drive files */
  driveMimeFilter: string;
}

export const DEFAULT_SETTINGS: GoogleWorkspaceSettings = {
  inboxQuery: 'is:unread',
  inboxLimit: 20,
  agendaRange: '7days',
  driveQuery: '',
  driveLimit: 20,
  driveMimeFilter: 'all',
};

// ─────────────────────────────────────────────────────────────────────────────
// Storage
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vienna-plugin:google_workspace:settings';
const CHANGE_EVENT = 'vienna-plugin:google_workspace:settings-changed';

function loadSettings(): GoogleWorkspaceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: GoogleWorkspaceSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // localStorage unavailable
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useGoogleWorkspaceSettings() {
  const [settings, setSettingsState] = useState(loadSettings);

  useEffect(() => {
    const handler = () => setSettingsState(loadSettings());
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);

  const updateSettings = useCallback((patch: Partial<GoogleWorkspaceSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
    setSettingsState(DEFAULT_SETTINGS);
  }, []);

  return { settings, updateSettings, resetSettings };
}
