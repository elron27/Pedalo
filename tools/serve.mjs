// Startet Pedalo ohne Entwicklungsumgebung: liefert den Ordner dist/ auf http://localhost:5173 aus
// und öffnet Chrome. Web Bluetooth braucht localhost (sicherer Kontext); gespeicherte Profile hängen an dieser Adresse,
// darum bleibt der Anschluss fest (Änderung mit PEDALO_PORT).
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const port = Number(process.env.PEDALO_PORT ?? 5173);
const url = `http://localhost:${port}/`;
const noOpen = process.argv.includes('--no-open');

if (!existsSync(join(root, 'index.html'))) {
  console.error('Der Ordner dist/ fehlt. Bitte zuerst „npm run build“ ausführen (oder „npm start“ benutzen).');
  process.exit(1);
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = normalize(join(root, path === '/' ? 'index.html' : path));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(readFileSync(file));
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Anschluss ${port} ist belegt. Läuft Pedalo oder der Entwicklungsserver schon? Dann einfach ${url} im Browser öffnen.`);
  } else console.error(e);
  process.exit(1);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Pedalo läuft auf ${url}  (beenden mit Strg+C)`);
  if (noOpen) return;
  if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', 'chrome', url], { stdio: 'ignore', detached: true }).unref();
  else if (process.platform === 'darwin') spawn('open', ['-a', 'Google Chrome', url], { stdio: 'ignore', detached: true }).unref();
  else spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
});
