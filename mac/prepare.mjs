// Kopiert die gebaute Web-App (../dist) in den Ordner der Mac-Hülle.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const from = fileURLToPath(new URL('../dist', import.meta.url));
const to = fileURLToPath(new URL('./dist', import.meta.url));
if (!existsSync(from + '/index.html')) {
  console.error('../dist fehlt. Bitte im Hauptordner zuerst „npm run build“ ausführen.');
  process.exit(1);
}
rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true });
console.log('App nach mac/dist kopiert.');
