import { appendFileSync, mkdirSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Nur für den M0-Spike: nimmt Protokollzeilen der Spike-Seite entgegen und hängt sie an docs/m0/live.jsonl.
const m0LiveLog = {
  name: 'm0-live-log',
  configureServer(server: { middlewares: { use: (path: string, fn: (req: any, res: any) => void) => void } }) {
    server.middlewares.use('/__log', (req, res) => {
      let body = '';
      req.on('data', (c: Buffer) => (body += c));
      req.on('end', () => {
        mkdirSync('docs/m0', { recursive: true });
        appendFileSync('docs/m0/live.jsonl', body + '\n');
        res.end('ok');
      });
    });
  },
};

export default defineConfig({
  plugins: [m0LiveLog],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
