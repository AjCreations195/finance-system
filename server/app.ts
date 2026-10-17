import { existsSync } from 'node:fs';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { type ChatClient, chatHandler } from './chat.ts';

export interface AppOptions {
  /** Claude API client; null when no API key is set (the chat answers 503). */
  client: ChatClient | null;
  /** Built Angular app (dist/…/browser), served in production. */
  staticDir?: string;
  /** Claude model for the chat (CLAUDE_MODEL); defaults to DEFAULT_MODEL in chat.ts. */
  model?: string;
  /** Chat requests allowed per visitor (IP) per window. A question takes one request per tool round. */
  chatLimit?: number;
}

const CHAT_WINDOW_MS = 10 * 60 * 1000;

/**
 * The Express app:
 *   GET  /api/health  → { ok, ai } (ai: whether a Claude API key is set)
 *   POST /api/chat    → streamed reply (see chat.ts), rate limited per IP
 *   anything else     → the Angular app, when `staticDir` exists
 */
export function createApp({ client, staticDir, model, chatLimit = 60 }: AppOptions): express.Express {
  const app = express();
  app.disable('x-powered-by');
  // Hosts like Render put one proxy in front; trust it so the rate limit sees real IPs.
  app.set('trust proxy', 1);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ai: client !== null });
  });

  app.post(
    '/api/chat',
    rateLimit({
      windowMs: CHAT_WINDOW_MS,
      limit: chatLimit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'rate_limited' },
    }),
    express.json({ limit: '1mb' }), // the whole conversation, with tool results
    client
      ? chatHandler(client, model)
      : (_req, res) => {
          res.status(503).json({ error: 'not_configured' });
        },
  );

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  if (staticDir && existsSync(staticDir)) {
    app.use(express.static(staticDir, { index: false }));
    // Client-side routes (/dashboard, /procurement/…) all load index.html.
    app.get('/{*path}', (_req, res) => {
      res.sendFile('index.html', { root: staticDir });
    });
  }

  return app;
}
