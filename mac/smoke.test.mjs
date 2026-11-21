// Rauchtest der Hülle: startet die echte Electron-App (aus dem Quellcode oder, mit PEDALO_EXE, das gebaute Programm),
// verbindet sich über das Chrome-Debug-Protokoll und prüft, dass die Web-App mit sicherem Ursprung, Web Bluetooth
// und Speicher läuft. (Playwrights eigener Electron-Start ist an die Electron-Version gebunden, CDP nicht.)
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const port = 9333;
const exe = process.env.PEDALO_EXE ?? createRequire(import.meta.url)('electron');
const args = [...(process.env.PEDALO_EXE ? [] : [dir]), `--remote-debugging-port=${port}`];
const child = spawn(exe, args, { stdio: 'ignore', env: { ...process.env, PEDALO_NO_LOCK: '1' } });
child.on('exit', (c) => c !== null && c !== 0 && console.error('Programm beendet mit', c));

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('Keine Verbindung zur Electron-App');
}

const browser = await connect();
try {
  let page;
  for (let i = 0; i < 30 && !page; i++) {
    page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().startsWith('pedalo://'));
    if (!page) await new Promise((r) => setTimeout(r, 1000));
  }
  assert.ok(page, 'Kein Pedalo-Fenster gefunden');
  await page.getByRole('heading', { name: 'Pedalo' }).waitFor({ timeout: 30_000 });
  const info = await page.evaluate(() => ({
    secure: window.isSecureContext,
    bluetooth: typeof navigator.bluetooth?.requestDevice,
    origin: location.origin,
    idb: typeof indexedDB,
  }));
  console.log('Umgebung:', JSON.stringify(info));
  assert.equal(info.secure, true, 'kein sicherer Ursprung');
  assert.equal(info.bluetooth, 'function', 'Web Bluetooth fehlt');
  assert.equal(info.idb, 'object');

  // Profil anlegen und nach Neuladen wiederfinden (IndexedDB unter dem eigenen Schema)
  await page.getByRole('button', { name: 'Neues Profil' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Testfahrer');
  await page.getByLabel('FTP (Watt)', { exact: true }).fill('250');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await page.waitForFunction(() => document.querySelector('select')?.textContent?.includes('Testfahrer (250 W)'));
  await page.reload();
  await page.waitForFunction(() => document.querySelector('select')?.textContent?.includes('Testfahrer (250 W)'));

  // Anleitung vorhanden, freies Training startet (ohne Bike wird die Verbindung weiter versucht)
  await page.getByRole('link', { name: 'Anleitung und Hilfe' }).waitFor();
  await page.getByRole('button', { name: 'Freies Training starten' }).click();
  await page.getByRole('button', { name: 'Beenden' }).waitFor();
  console.log('Rauchtest bestanden.');
} finally {
  await browser.close().catch(() => {});
  child.kill();
}
