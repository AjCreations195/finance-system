import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { createApp } from './app.ts';
import { DEFAULT_MODEL } from './chat.ts';

/**
 * Starts the server.
 *
 *   npm run server        development: reads .env, restarts on changes
 *   npm run server:prod   production (Render): settings come from the host
 *
 * Environment:
 *   ANTHROPIC_API_KEY  Claude API key (required for the chat)
 *   CLAUDE_MODEL       default claude-opus-5-5; claude-haiku-5-5 is much cheaper for development
 *   PORT               default 3000
 */
const port = Number(process.env['PORT'] ?? 3000);
const model = process.env['CLAUDE_MODEL']?.trim() || DEFAULT_MODEL;
const staticDir = path.resolve(import.meta.dirname, '../dist/financial-system/browser');

const hasKey = !!process.env['ANTHROPIC_API_KEY'];
if (!hasKey) {
  console.warn('[server] ANTHROPIC_API_KEY is not set: the chat will answer "not configured". Add it to .env (see .env.example).');
}

const app = createApp({ client: hasKey ? new Anthropic() : null, staticDir, model });

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port} (model: ${model})`);
});
