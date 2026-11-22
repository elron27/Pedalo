import { Decoder, Stream } from '@garmin/fitsdk';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { installFakes } from './fake-ble';

// Tests zu GitHub-Issue 2 (eigene Pulszonen) und 3 (Fahrt beginnt mit dem ersten Tritt).

const call = (page: Page, expr: string) => page.evaluate(`(() => { const f = window.__fake; return ${expr}; })()`);
const emitBike = (page: Page, d: { power: number; cadence: number; speedKmh: number }) => call(page, `f.bikeEmit(${JSON.stringify(d)})`);
const writes = (page: Page) => call(page, 'f.writes') as Promise<number[][]>;
const bikeStatus = (page: Page) => page.locator('strong[data-status]').first();
const gurtStatus = (page: Page) => page.locator('strong[data-status]').nth(1);
const zonenFeld = (page: Page) => page.getByLabel('Pulszonen: Obergrenze je Zone (optional)');

async function start(page: Page) {
  await installFakes(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pedalo' })).toBeVisible();
}

async function pairBike(page: Page) {
  await page.getByRole('button', { name: 'Bike koppeln' }).click();
  await expect(bikeStatus(page)).toHaveText('verbunden');
}

async function pairStrap(page: Page) {
  await page.getByRole('button', { name: 'Pulsgurt koppeln' }).click();
  await expect(gurtStatus(page)).toHaveText('verbunden');
}

async function startManual(page: Page, text: string) {
  await page.getByRole('tab', { name: 'Von Hand' }).click();
  await page.getByLabel('Name des Trainings').fill('Test');
  await page.getByRole('textbox', { name: 'Von Hand' }).fill(text);
  await page.getByRole('button', { name: 'Eingegebenes Training starten' }).click();
  await expect(page.getByRole('button', { name: 'Beenden' })).toBeVisible();
}

const totalSec = async (page: Page) => {
  const [m, s] = ((await page.locator('#gesamtzeit .zahl').textContent()) ?? '0:00').split(':').map(Number) as [number, number];
  return m * 60 + s;
};

function readFit(path: string) {
  const d = new Decoder(Stream.fromByteArray(Array.from(readFileSync(path))));
  return d.read().messages;
}

test.describe('Fahrt beginnt mit dem ersten Tritt', () => {
  test('[SR-ac9179/AK-vtjn] ohne Tritt steht die Uhr bei 0:00, nichts wird aufgezeichnet, der Hinweis ist sichtbar', async ({ page }) => {
    await start(page);
    await pairBike(page);
    await startManual(page, '10:00 150');
    for (let i = 0; i < 5; i++) {
      await emitBike(page, { power: 0, cadence: 0, speedKmh: 0 });
      await page.waitForTimeout(1000);
    }
    await expect(page.locator('#gesamtzeit .zahl')).toHaveText('0:00');
    await expect(page.locator('#restzeit .zahl')).toHaveText('10:00');
    await expect(page.locator('#wartet')).toHaveText('Bereit – die Fahrt beginnt, sobald du trittst.');
    expect((await writes(page)).some((w) => w[0] === 0x05)).toBe(false); // noch keine Zielwatt am Bike
    // Danach sofort beginnen und beenden: die Aufzeichnung enthält die 5 Sekunden davor nicht.
    await page.getByRole('button', { name: 'Jetzt starten' }).click();
    await page.getByRole('button', { name: 'Beenden' }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '.fit-Datei speichern' }).click()]);
    expect(readFit((await dl.path())!).recordMesgs?.length ?? 0).toBeLessThanOrEqual(1);
  });

  test('[SR-ac9179/AK-pwqd] mit dem ersten Tritt laufen Uhr und Aufzeichnung, Beginn der Aufzeichnung ist dieser Zeitpunkt', async ({ page }) => {
    await start(page);
    await pairBike(page);
    await page.getByRole('button', { name: 'Freies Training starten' }).click();
    await expect(page.locator('#wartet')).toBeVisible();
    await page.waitForTimeout(3000);
    const t0 = Date.now();
    for (let i = 0; i < 4; i++) {
      await emitBike(page, { power: 0, cadence: 12, speedKmh: 20 });
      await page.waitForTimeout(1000);
    }
    await expect(page.locator('#wartet')).toHaveCount(0);
    expect(await totalSec(page)).toBeGreaterThanOrEqual(2);
    expect(await totalSec(page)).toBeLessThanOrEqual(5);
    await page.getByRole('button', { name: 'Beenden' }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '.fit-Datei speichern' }).click()]);
    const m = readFit((await dl.path())!);
    const startTime = (m.sessionMesgs![0]!.startTime as Date).getTime();
    expect(startTime).toBeGreaterThanOrEqual(t0 - 1500);
    expect(startTime).toBeLessThanOrEqual(t0 + 1500);
    expect(m.recordMesgs![0]!.cadence).toBe(12);
  });

  test('[SR-ac9179/AK-vdj7] „Jetzt starten“ beginnt die Fahrt ohne Tritt', async ({ page }) => {
    await start(page);
    await startManual(page, '10:00 150');
    await expect(page.locator('#wartet')).toBeVisible();
    await page.getByRole('button', { name: 'Jetzt starten' }).click();
    await expect(page.locator('#wartet')).toHaveCount(0);
    await expect.poll(() => totalSec(page), { timeout: 5000 }).toBeGreaterThanOrEqual(2);
    await page.getByRole('button', { name: 'Beenden' }).click();
    await expect(page.getByRole('heading', { name: 'Fahrt beendet' })).toBeVisible();
  });

  test('[SR-ac9179/AK-rdgn] „Beenden“ vor dem ersten Tritt führt zum Start zurück und speichert keine Fahrt', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: 'Freies Training starten' }).click();
    await expect(page.locator('#wartet')).toBeVisible();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Beenden' }).click();
    await expect(page.getByRole('button', { name: 'Freies Training starten' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fahrt beendet' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Freies Training starten' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Letzte Fahrten' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Nicht beendete Fahrt gefunden' })).toHaveCount(0);
  });
});

test.describe('Eigene Pulszonen im Profil', () => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const icuZones = (page: Page) =>
    page.route('https://intervals.icu/**', async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      return route.fulfill({
        status: 200,
        headers: cors,
        contentType: 'application/json',
        body: JSON.stringify({ sportSettings: [{ types: ['Ride'], hr_zones: [111, 130, 148, 158, 168, 178, 190] }] }),
      });
    });

  async function profileWithIcu(page: Page, zones = '') {
    await page.getByRole('button', { name: 'Neues Profil' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Stefan');
    await page.getByLabel('FTP (Watt)', { exact: true }).fill('274');
    await page.getByLabel('intervals.icu Athlet-ID (optional)').fill('i123');
    await page.getByLabel('intervals.icu API-Schlüssel (optional)').fill('geheim');
    if (zones) await zonenFeld(page).fill(zones);
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('combobox', { name: /^Fahrer/ })).toContainText('Stefan (274 W)');
  }

  test('[SR-7f8583/AK-t85h] eingetragene Zonen gelten auf dem Fahrtbildschirm, auch wenn intervals.icu andere liefert', async ({ page }) => {
    await icuZones(page);
    await start(page);
    await profileWithIcu(page, '130, 149, 160, 172, 185');
    await pairStrap(page);
    await startManual(page, '10:00 150');
    await page.getByRole('button', { name: 'Jetzt starten' }).click();
    await call(page, "f.hrEmit('gurt1', 149)");
    await expect(page.locator('#puls .unter')).toHaveText('Zone 2'); // mit den Zonen aus intervals.icu wäre es Zone 4
    await call(page, "f.hrEmit('gurt1', 150)");
    await expect(page.locator('#puls .unter')).toHaveText('Zone 3');
    await page.waitForTimeout(1000); // der Abruf aus intervals.icu ist durch und überschreibt die eigenen Zonen nicht
    await call(page, "f.hrEmit('gurt1', 149)");
    await expect(page.locator('#puls .unter')).toHaveText('Zone 2');
    await page.getByRole('button', { name: 'Beenden' }).click();
    await page.getByRole('button', { name: 'Zurück zum Start' }).click();
    await page.reload();
    await expect(page.locator('#zonen-gelten')).toContainText('selbst eingetragen');
    await expect(page.locator('#zonen-gelten')).toContainText('Zone 2: 131–149');
  });

  test('[SR-7f8583/AK-qrwz] fehlerhafte Obergrenzen werden nicht gespeichert, eine Meldung nennt den Fehler', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: 'Neues Profil' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Stefan');
    await page.getByLabel('FTP (Watt)', { exact: true }).fill('274');
    await zonenFeld(page).fill('130, 120, 160');
    await expect(page.getByText('Pulszonen: Die Obergrenzen müssen von Zone zu Zone steigen.').first()).toBeVisible();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByLabel('Name', { exact: true })).toBeVisible(); // Formular bleibt offen
    await expect(page.getByRole('combobox', { name: /^Fahrer/ })).not.toContainText('Stefan');
    for (const [input, msg] of [
      ['149', 'Pulszonen: Bitte mindestens 2 Obergrenzen eintragen.'],
      ['130, abc', 'Pulszonen: „abc“ ist keine ganze Zahl.'],
      ['130, 300', 'Pulszonen: 300 liegt nicht zwischen 40 und 250.'],
    ] as const) {
      await zonenFeld(page).fill(input);
      await expect(page.getByText(msg).first()).toBeVisible();
    }
  });

  test('[SR-7f8583/AK-wybx] ohne eigene Zonen gelten die Zonen aus intervals.icu', async ({ page }) => {
    await icuZones(page);
    await start(page);
    await profileWithIcu(page);
    await pairStrap(page);
    await startManual(page, '10:00 150');
    await call(page, "f.hrEmit('gurt1', 149)");
    await expect(page.locator('#puls .unter')).toHaveText('Zone 4');
    await page.getByRole('button', { name: 'Beenden' }).click();
    await expect(page.locator('#zonen-gelten')).toContainText('aus intervals.icu');
  });

  test('[SR-7f8583/AK-gsr1] unter dem Feld stehen die Bereiche jeder Zone; Zonen aus intervals.icu lassen sich übernehmen', async ({ page }) => {
    await icuZones(page);
    await start(page);
    await page.getByRole('button', { name: 'Neues Profil' }).click();
    await zonenFeld(page).fill('130, 149, 160');
    const vorschau = page.getByRole('list', { name: 'Vorschau Pulszonen' });
    await expect(vorschau).toContainText('Zone 1: bis 130');
    await expect(vorschau).toContainText('Zone 2: 131–149');
    await expect(vorschau).toContainText('Zone 3: 150–160');
    await page.getByLabel('intervals.icu Athlet-ID (optional)').fill('i123');
    await page.getByLabel('intervals.icu API-Schlüssel (optional)').fill('geheim');
    await page.getByRole('button', { name: 'Aus intervals.icu übernehmen' }).click();
    await expect(zonenFeld(page)).toHaveValue('111, 130, 148, 158, 168, 178, 190');
    await expect(vorschau).toContainText('Zone 7: 179–190');
  });
});
