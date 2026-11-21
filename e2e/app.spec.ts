import { Decoder, Stream } from '@garmin/fitsdk';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const events = JSON.parse(readFileSync('tests/fixtures/icu-events.json', 'utf8'));
import { installFakes, type FakeHandle } from './fake-ble';

const call = (page: Page, expr: string) => page.evaluate(`(() => { const f = window.__fake; return ${expr}; })()`);
const emitBike = (page: Page, d: { power: number; cadence: number; speedKmh: number }) => call(page, `f.bikeEmit(${JSON.stringify(d)})`);
const writes = (page: Page) => call(page, 'f.writes') as Promise<number[][]>;

const bikeStatus = (page: Page) => page.locator('strong[data-status]').first();
const gurtStatus = (page: Page) => page.locator('strong[data-status]').nth(1);

async function start(page: Page) {
  await installFakes(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pedalo' })).toBeVisible();
}

async function pairBike(page: Page) {
  await page.getByRole('button', { name: 'Bike koppeln' }).click();
  await expect(bikeStatus(page)).toHaveText('verbunden');
}

async function startManual(page: Page, text: string, name = 'Test') {
  await page.getByRole('tab', { name: 'Von Hand' }).click();
  await page.getByLabel('Name des Trainings').fill(name);
  await page.getByRole('textbox', { name: 'Von Hand' }).fill(text);
  await page.getByRole('button', { name: 'Eingegebenes Training starten' }).click();
  await expect(page.getByRole('button', { name: 'Beenden' })).toBeVisible();
}

async function readFit(path: string) {
  const bytes = Array.from(readFileSync(path));
  const stream = Stream.fromByteArray(bytes);
  const d = new Decoder(stream);
  const isFit = Decoder.isFIT(stream);
  const integrity = d.checkIntegrity();
  const { messages, errors } = d.read();
  return { isFit, integrity, messages, errors };
}

test.describe('Fahrt', () => {
  test('[SR-e32fa8/AK-r0yj] Gastmodus: FTP von Hand, freies Training fahren, kein Upload angeboten', async ({ page }) => {
    await start(page);
    await expect(page.getByRole('combobox', { name: /^Fahrer/ })).toHaveValue(''); // Gast ist vorgewählt
    await page.getByLabel('FTP (Watt) für diese Fahrt').fill('250');
    await pairBike(page);
    await page.getByRole('button', { name: 'Freies Training starten' }).click();
    await emitBike(page, { power: 150, cadence: 85, speedKmh: 30 });
    await expect(page.locator('#watt .zahl')).toHaveText('150');
    await page.getByRole('button', { name: 'Beenden' }).click();
    await expect(page.getByRole('heading', { name: 'Fahrt beendet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zu intervals.icu hochladen' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '.fit-Datei speichern' })).toBeVisible();
  });

  test('[SR-f073cf/AK-ywz6] freies Training sendet Simulationswerte statt Zielwatt, auch aus einem Workout heraus', async ({ page }) => {
    await start(page);
    await pairBike(page);
    await page.getByRole('button', { name: 'Freies Training starten' }).click();
    await expect.poll(async () => (await writes(page)).some((w) => w[0] === 0x11)).toBe(true);
    expect((await writes(page)).some((w) => w[0] === 0x05)).toBe(false); // keine Zielleistung
    expect((await writes(page)).find((w) => w[0] === 0x11)).toEqual([0x11, 0, 0, 0, 0, 40, 51]); // Steigung 0 %
    await page.getByRole('button', { name: 'Beenden' }).click();
    await page.getByRole('button', { name: 'Zurück zum Start' }).click();

    await startManual(page, '10:00 180');
    await expect.poll(async () => (await writes(page)).some((w) => w[0] === 0x05 && w[1] === 180)).toBe(true);
    const n = (await writes(page)).length;
    await page.getByRole('button', { name: 'Freies Training zuschalten' }).click();
    await expect.poll(async () => (await writes(page)).slice(n).some((w) => w[0] === 0x11)).toBe(true);
    await page.getByRole('button', { name: 'Zurück zum Training' }).click();
    await expect.poll(async () => (await writes(page)).slice(n).filter((w) => w[0] === 0x05 && w[1] === 180).length).toBe(1);
  });

  test('[SR-88ab50/AK-pq4b] Watt, Puls, Trittfrequenz, Restzeit des Blocks und Gesamtzeit sind gleichzeitig sichtbar', async ({ page }) => {
    await start(page);
    await pairBike(page);
    await page.getByRole('button', { name: 'Pulsgurt koppeln' }).click();
    await expect(gurtStatus(page)).toHaveText('verbunden');
    await startManual(page, '10:00 150');
    await emitBike(page, { power: 148, cadence: 88, speedKmh: 31 });
    await call(page, "f.hrEmit('gurt1', 132)");
    await expect(page.locator('#watt .zahl')).toHaveText('148');
    await expect(page.locator('#puls .zahl')).toHaveText('132');
    await expect(page.locator('#trittfrequenz .zahl')).toHaveText('88');
    await expect(page.locator('#restzeit .zahl')).toHaveText(/^\d+:\d\d$/);
    await expect(page.locator('#gesamtzeit .zahl')).toHaveText(/^\d+:\d\d$/);
    for (const id of ['watt', 'puls', 'trittfrequenz', 'restzeit', 'gesamtzeit']) await expect(page.locator(`#${id}`)).toBeVisible();
  });

  test('[SR-f1a89f/AK-fy62] [SR-d51418/AK-np6p] zeigt Status verbunden bzw. getrennt für Bike und Pulsgurt', async ({ page }) => {
    await start(page);
    await expect(bikeStatus(page)).toHaveText('getrennt');
    await expect(gurtStatus(page)).toHaveText('getrennt');
    await pairBike(page);
    await page.getByRole('button', { name: 'Pulsgurt koppeln' }).click();
    await expect(gurtStatus(page)).toHaveText('verbunden');
    await call(page, "(f.failConnects = 1, f.drop('bike'))");
    await expect(bikeStatus(page)).toHaveText('getrennt');
    await expect(bikeStatus(page)).toHaveText('verbunden', { timeout: 10_000 });
  });

  test('[SR-1a292f/AK-s8zr] bei Bluetooth-Abbruch läuft der Timer weiter, die App verbindet neu und setzt die Zielwatt erneut', async ({ page }) => {
    await start(page);
    await pairBike(page);
    await startManual(page, '10:00 180');
    await expect.poll(async () => (await writes(page)).filter((w) => w[0] === 0x05 && w[1] === 180).length).toBe(1);
    await page.waitForTimeout(1200);
    const secs = async () => {
      const t = (await page.locator('#gesamtzeit .zahl').textContent()) ?? '0:00';
      const [m, s] = t.split(':').map(Number) as [number, number];
      return m * 60 + s;
    };
    const before = await secs();
    await call(page, "(f.failConnects = 1, f.drop('bike'))"); // Abbruch, der erste Wiederverbindungsversuch scheitert
    await expect(bikeStatus(page)).toHaveText('getrennt');
    await expect(bikeStatus(page)).toHaveText('verbunden', { timeout: 10_000 });
    expect(await secs()).toBeGreaterThanOrEqual(before + 2); // Timer lief ohne Bike weiter
    await expect.poll(async () => (await writes(page)).filter((w) => w[0] === 0x05 && w[1] === 180).length, { timeout: 5000 }).toBe(2);
  });

  test('[SR-00e7dd/AK-cd88] beim Blockwechsel wird die Zielwatt des neuen Blocks am Bike gesetzt', async ({ page }) => {
    await start(page);
    await pairBike(page);
    await startManual(page, '0:02 100\n1:00 200');
    await expect.poll(async () => (await writes(page)).some((w) => w[0] === 0x05 && w[1] === 100)).toBe(true);
    await expect.poll(async () => (await writes(page)).some((w) => w[0] === 0x05 && w[1] === 200 && w[2] === 0), { timeout: 6000 }).toBe(true);
  });

  test('[SR-7ed21c/AK-zvs5] die Intensität in Prozent wirkt sofort auf die Zielwatt', async ({ page }) => {
    await start(page);
    await pairBike(page);
    await startManual(page, '10:00 180');
    await page.getByRole('button', { name: 'Mehr' }).click();
    await expect(page.getByText('Intensität 105 %')).toBeVisible();
    await expect.poll(async () => (await writes(page)).some((w) => w[0] === 0x05 && w[1] === 189)).toBe(true);
  });

  test('[SR-23612e/AK-pw4j] zeigt den nächsten Block und das Profil des Trainings', async ({ page }) => {
    await start(page);
    await startManual(page, '1:00 100\n2:00 200');
    await expect(page.getByText(/Nächster Block: .*2:00 · 200 W/)).toBeVisible();
    await expect(page.getByRole('img', { name: 'Profil' })).toBeVisible();
    await page.getByRole('button', { name: 'Block überspringen' }).click();
    await expect(page.getByText('Nächster Block: Letzter Block')).toBeVisible();
  });

  test('[SR-9851f3/AK-x0cv] der Bildschirm bleibt während des Trainings an', async ({ page }) => {
    await start(page);
    await page.getByRole('button', { name: 'Freies Training starten' }).click();
    await expect.poll(() => call(page, 'f.wake')).toEqual(['screen']);
    await page.getByRole('button', { name: 'Beenden' }).click();
    await expect.poll(() => call(page, 'f.wake')).toEqual(['screen', 'release']);
  });
});

test.describe('Aufzeichnung und Datei', () => {
  test('[SR-e21b18/AK-tz7v] nach dem Training lässt sich eine gültige .fit-Datei speichern', async ({ page }) => {
    await start(page);
    await pairBike(page);
    await page.getByRole('button', { name: 'Freies Training starten' }).click();
    for (let i = 0; i < 4; i++) {
      await emitBike(page, { power: 200 + i, cadence: 90, speedKmh: 32 });
      await page.waitForTimeout(1000);
    }
    await page.getByRole('button', { name: 'Beenden' }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '.fit-Datei speichern' }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^pedalo-\d{8}-\d{4}-Freies_Training\.fit$/);
    const { isFit, integrity, messages, errors } = await readFit((await dl.path())!);
    expect(isFit && integrity).toBe(true);
    expect(errors).toHaveLength(0);
    expect(messages.recordMesgs!.length).toBeGreaterThanOrEqual(3);
    expect(messages.recordMesgs![0]!.power).toBeGreaterThanOrEqual(200);
  });

  test('[SR-a6bbe0/AK-zjfx] nach geschlossenem Tab lässt sich die .fit-Datei aus der Zwischenspeicherung erzeugen', async ({ page, context }) => {
    await start(page);
    await pairBike(page);
    await page.getByRole('button', { name: 'Freies Training starten' }).click();
    for (let i = 0; i < 14; i++) {
      await emitBike(page, { power: 180, cadence: 85, speedKmh: 30 });
      await page.waitForTimeout(500);
    }
    await page.close({ runBeforeUnload: false }); // Tab weg, Fahrt nicht beendet

    const page2 = await context.newPage();
    await installFakes(page2);
    await page2.goto('/');
    await expect(page2.getByRole('heading', { name: 'Nicht beendete Fahrt gefunden' })).toBeVisible();
    await page2.getByRole('button', { name: 'Wiederherstellen' }).click();
    const [dl] = await Promise.all([page2.waitForEvent('download'), page2.getByRole('button', { name: '.fit-Datei speichern' }).click()]);
    const { isFit, integrity, messages, errors } = await readFit((await dl.path())!);
    expect(isFit && integrity).toBe(true);
    expect(errors).toHaveLength(0);
    expect(messages.recordMesgs!.length).toBeGreaterThanOrEqual(5);
  });
});

test.describe('Fahrer, Pulsgurte, Bibliothek', () => {
  async function createProfile(page: Page, name: string, ftp: string, athlete = '', key = '') {
    await page.getByRole('button', { name: 'Neues Profil' }).click();
    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByLabel('FTP (Watt)', { exact: true }).fill(ftp);
    if (athlete) await page.getByLabel('intervals.icu Athlet-ID (optional)').fill(athlete);
    if (key) await page.getByLabel('intervals.icu API-Schlüssel (optional)').fill(key);
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('combobox', { name: /^Fahrer/ })).toContainText(`${name} (${ftp} W)`);
  }

  test('[SR-920097/AK-njhr] jedes Profil behält nach Neustart sein eigenes FTP; [SR-0bf586/AK-c04m] Wechsel schaltet das Profil um', async ({ page }) => {
    await start(page);
    await createProfile(page, 'Anna', '210', 'iAnna', 'schlA');
    await createProfile(page, 'Stefan', '274', 'iStefan', 'schlS');
    await page.reload();
    const sel = page.getByRole('combobox', { name: /^Fahrer/ });
    await expect(sel.locator('option')).toContainText(['Gast (ohne Profil und ohne Konten)', 'Anna (210 W)', 'Stefan (274 W)']);
    await expect(sel.locator('option:checked')).toHaveText('Stefan (274 W)'); // zuletzt gewählt, nach Neustart aktiv
    await sel.selectOption({ label: 'Anna (210 W)' });
    await expect(sel.locator('option:checked')).toHaveText('Anna (210 W)');
    await page.getByRole('button', { name: 'Profil bearbeiten' }).click();
    await expect(page.getByLabel('FTP (Watt)', { exact: true })).toHaveValue('210');
    await expect(page.getByLabel('intervals.icu Athlet-ID (optional)')).toHaveValue('iAnna');
  });

  test('[SR-a54eef/AK-nj88] ein gespeicherter Pulsgurt wird ohne erneutes Koppeln verbunden', async ({ page }) => {
    await start(page);
    await createProfile(page, 'Stefan', '274');
    await page.getByRole('button', { name: 'Pulsgurt koppeln' }).click();
    await expect(gurtStatus(page)).toHaveText('verbunden');
    await page.getByRole('button', { name: 'Pulsgurt koppeln' }).click(); // zweiter Gurt
    await expect(page.getByRole('combobox', { name: /^Gespeicherte Pulsgurte/ }).locator('option')).toHaveText(['Gurt 1', 'Gurt 2']);
    const choosers = await call(page, 'f.choosers');
    await page.getByRole('combobox', { name: /^Gespeicherte Pulsgurte/ }).selectOption({ label: 'Gurt 1' });
    await expect(gurtStatus(page)).toHaveText('verbunden');
    expect(await call(page, 'f.choosers')).toBe(choosers); // kein neues Auswahlfenster
  });

  test('[SR-35475a/AK-r0vk] [SR-3dbb4e/AK-w830] ein Favorit ist nach Neustart ohne Internet vorhanden, die Auswahl startet das Training', async ({ page }) => {
    await page.route((u) => u.hostname !== 'localhost', (r) => r.abort()); // kein Internet, nur die lokale App
    await start(page);
    await page.getByRole('tab', { name: 'Von Hand' }).click();
    await page.getByLabel('Name des Trainings').fill('Mein Training');
    await page.getByRole('textbox', { name: 'Von Hand' }).fill('5:00 150');
    await page.getByRole('button', { name: 'In Bibliothek speichern' }).click();
    await expect(page.getByText('In der Bibliothek gespeichert.')).toBeVisible();
    await page.reload();
    await page.getByRole('tab', { name: 'Bibliothek' }).click();
    await expect(page.getByText('Mein Training · 1 Block · 5:00')).toBeVisible();
    await expect(page.getByRole('button', { name: '★ Favorit' })).toBeVisible();
    await page.getByRole('button', { name: 'Starten' }).click();
    await expect(page.getByText('Mein Training')).toBeVisible();
    await expect(page.locator('#restzeit .zahl')).toHaveText(/^\d:\d\d$/);
  });
});

test.describe('intervals.icu', () => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

  test('[SR-130c03/AK-jhkv] [SR-4bd74c/AK-bgx5] zeigt Radtrainings mit Blöcken und lädt die Fahrt auf das Konto des aktiven Fahrers hoch', async ({ page }) => {
    const requests: { method: string; url: string; auth?: string }[] = [];
    await page.route('https://intervals.icu/**', async (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      requests.push({ method: req.method(), url: req.url(), auth: req.headers().authorization });
      if (req.url().includes('/events')) return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(events) });
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ id: 'i99', activities: [{ id: 'i99' }] }) });
    });
    await start(page);
    await page.getByRole('button', { name: 'Neues Profil' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Stefan');
    await page.getByLabel('FTP (Watt)', { exact: true }).fill('274');
    await page.getByLabel('intervals.icu Athlet-ID (optional)').fill('i123');
    await page.getByLabel('intervals.icu API-Schlüssel (optional)').fill('geheim');
    await page.getByRole('button', { name: 'Speichern' }).click();

    await page.getByRole('tab', { name: 'intervals.icu' }).click();
    await page.getByRole('button', { name: 'Trainings der nächsten 14 Tage laden' }).click();
    await expect(page.getByText('Sweet spot 2×20′ · 7 Block · 1:10:00')).toBeVisible();
    await expect(page.getByText('Z2-Ausfahrt ~100′')).toBeVisible();
    await expect(page.getByText('Gym A')).toHaveCount(0);
    await expect(page.getByText('Lauf locker')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Freies Training' }).click();
    await page.getByRole('button', { name: 'Freies Training starten' }).click();
    await page.getByRole('button', { name: 'Beenden' }).click();
    await page.getByRole('button', { name: 'Zu intervals.icu hochladen' }).click();
    await expect(page.getByText('Hochgeladen zu intervals.icu (Aktivität i99).')).toBeVisible();
    const up = requests.find((r) => r.method === 'POST')!;
    expect(up.url).toBe('https://intervals.icu/api/v1/athlete/i123/activities');
    expect(Buffer.from(up.auth!.replace('Basic ', ''), 'base64').toString()).toBe('API_KEY:geheim');
  });
});

test.describe('Darstellung', () => {
  test('[SR-8bfae1/AK-g9hb] die Oberfläche nutzt auf allen Bildschirmen ein dunkles Farbschema', async ({ page }) => {
    const dark = () =>
      page.evaluate(() => {
        const lum = (c: string) => {
          const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c);
          if (!m) return 0;
          if (m[4] !== undefined && Number(m[4]) === 0) return -1; // transparent
          const [r, g, b] = [m[1], m[2], m[3]].map((v) => {
            const x = Number(v) / 255;
            return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
        };
        const bad: string[] = [];
        for (const el of Array.from(document.querySelectorAll('body, body *'))) {
          if (el.closest('button, .banner, svg')) continue; // Bedienelemente und Warnbalken dürfen farbig sein
          const l = lum(getComputedStyle(el).backgroundColor);
          if (l > 0.12) bad.push(`${el.tagName}.${el.className} ${getComputedStyle(el).backgroundColor}`);
        }
        return { bad, scheme: getComputedStyle(document.documentElement).colorScheme, body: lum(getComputedStyle(document.body).backgroundColor) };
      });
    await start(page);
    let r = await dark();
    expect(r.bad).toEqual([]);
    expect(r.scheme).toBe('dark');
    expect(r.body).toBeLessThan(0.05);
    await pairBike(page);
    await page.getByRole('button', { name: 'Freies Training starten' }).click();
    r = await dark();
    expect(r.bad).toEqual([]);
    await page.getByRole('button', { name: 'Beenden' }).click();
    await expect(page.getByRole('heading', { name: 'Fahrt beendet' })).toBeVisible();
    r = await dark();
    expect(r.bad).toEqual([]);
  });

  test('Live-Werte sind in Vollbildgröße sehr groß (Anhaltspunkt für die Abnahme aus der Distanz)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await start(page);
    await page.getByRole('button', { name: 'Freies Training starten' }).click();
    const size = await page.locator('#watt .zahl').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(size).toBeGreaterThanOrEqual(150);
    await expect(page.getByRole('button', { name: 'Vollbild' })).toBeVisible();
  });
});

test.describe('FTP-Tests in der Oberfläche', () => {
  test('die drei FTP-Tests werden zur Auswahl angeboten', async ({ page }) => {
    await start(page);
    await page.getByRole('tab', { name: 'FTP-Test' }).click();
    await expect(page.getByText('20-Minuten-Test')).toBeVisible();
    await expect(page.getByText('Wahoo-4DP-Test')).toBeVisible();
    await expect(page.getByText('Rampentest')).toBeVisible();
  });
});
