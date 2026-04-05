/**
 * Google Workspace Integration — gws CLI client.
 *
 * Auth is fully delegated to the `gws` CLI. Users must run `gws auth login`
 * in their terminal. The integration checks `gws auth status` to determine
 * if a client can be created.
 *
 * No OAuth config or credentials are managed by Vienna — the gws binary
 * handles its own token storage in ~/.config/gws/.
 */

import { defineIntegration } from '@tryvienna/sdk';
import type { IntegrationDefinition } from '@tryvienna/sdk';
import { GwsClient } from './gws-client';
import { registerGoogleWorkspaceSchema } from './schema';

const GWS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>';

export const googleWorkspaceIntegration: IntegrationDefinition<GwsClient> = defineIntegration<GwsClient>({
  id: 'google_workspace',
  name: 'Google Workspace',
  description: 'Gmail, Calendar, and Drive via the gws CLI',
  icon: { svg: GWS_SVG },

  createClient: async (ctx) => {
    const client = new GwsClient();
    const authed = await client.isAuthenticated();
    if (!authed) {
      ctx.logger.warn('gws CLI not authenticated. Run `gws auth login` in your terminal.');
      return null;
    }
    ctx.logger.info('gws CLI authenticated');
    return client;
  },

  schema: registerGoogleWorkspaceSchema,
});
