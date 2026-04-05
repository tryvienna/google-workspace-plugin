/**
 * Opens a URL in the system default browser.
 *
 * Uses Vienna's Electron shell API when available (desktop app),
 * falls back to window.open for browser/storybook contexts.
 */
export function openExternalUrl(url: string) {
  if (typeof window !== 'undefined' && 'api' in window) {
    void (
      window.api as { shell: { openExternal: (opts: { url: string }) => void } }
    ).shell.openExternal({ url });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
