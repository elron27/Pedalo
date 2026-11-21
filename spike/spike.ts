// M0-Spike: wird nach der Messung weggeworfen. Kein Anspruch auf Qualität.
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const logEl = $('log');
const entries: unknown[] = [];
const t0 = performance.now();

function log(kind: string, data?: unknown) {
  const e = { t: Math.round(performance.now() - t0), at: new Date().toISOString(), kind, data };
  entries.push(e);
  logEl.textContent += `${(e.t / 1000).toFixed(1)}s ${kind} ${data === undefined ? '' : JSON.stringify(data)}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}
const hex = (d: DataView) =>
  Array.from(new Uint8Array(d.buffer, d.byteOffset, d.byteLength), (b) => b.toString(16).padStart(2, '0')).join(' ');

// ---------- FTMS ----------
const FTMS = 0x1826;
const CH = { bikeData: 0x2ad2, control: 0x2ad9, feature: 0x2acc, powerRange: 0x2ad8, status: 0x2ada, training: 0x2ad3 };
let bike: BluetoothDevice | undefined;
let ctrl: BluetoothRemoteGATTCharacteristic | undefined;
let lastPower: number | undefined;
let lastLogSecond = -1;

function parseBikeData(d: DataView) {
  const flags = d.getUint16(0, true);
  let o = 2;
  const out: { speedKmh?: number; avgSpeed?: number; cadence?: number; avgCadence?: number; distance?: number; resistance?: number; power?: number; avgPower?: number; energy?: number; hr?: number; elapsed?: number; remaining?: number } = {};
  const u16 = () => { const v = d.getUint16(o, true); o += 2; return v; };
  const s16 = () => { const v = d.getInt16(o, true); o += 2; return v; };
  if (!(flags & 1)) out.speedKmh = u16() / 100;
  if (flags & 2) out.avgSpeed = u16() / 100;
  if (flags & 4) out.cadence = u16() / 2;
  if (flags & 8) out.avgCadence = u16() / 2;
  if (flags & 16) { out.distance = d.getUint16(o, true) + (d.getUint8(o + 2) << 16); o += 3; }
  if (flags & 32) out.resistance = s16();
  if (flags & 64) out.power = s16();
  if (flags & 128) out.avgPower = s16();
  if (flags & 256) { out.energy = u16(); u16(); o += 1; }
  if (flags & 512) { out.hr = d.getUint8(o); o += 1; }
  if (flags & 1024) o += 1;
  if (flags & 2048) out.elapsed = u16();
  if (flags & 4096) out.remaining = u16();
  return { flags, ...out };
}

async function setupBike(dev: BluetoothDevice) {
  const server = await dev.gatt!.connect();
  log('bike.connected', { name: dev.name, id: dev.id });
  const svc = await server.getPrimaryService(FTMS);
  const names = new Map<number, string>(Object.entries(CH).map(([k, v]) => [v, k]));
  for (const c of await svc.getCharacteristics()) {
    const uuid16 = parseInt(c.uuid.slice(4, 8), 16);
    const props = Object.entries(c.properties).filter(([, v]) => v === true).map(([k]) => k);
    log('bike.characteristic', { uuid: c.uuid, name: names.get(uuid16), props });
  }
  const read = async (id: number, label: string) => {
    try { log(label, hex(await (await svc.getCharacteristic(id)).readValue())); }
    catch (e) { log(label + '.fehler', String(e)); }
  };
  await read(CH.feature, 'bike.feature');
  await read(CH.powerRange, 'bike.powerRange');

  const data = await svc.getCharacteristic(CH.bikeData);
  data.addEventListener('characteristicvaluechanged', (ev) => {
    const d = (ev.target as BluetoothRemoteGATTCharacteristic).value!;
    const p = parseBikeData(d);
    $('w').textContent = p.power?.toString() ?? '–';
    $('c').textContent = p.cadence?.toString() ?? '–';
    $('s').textContent = p.speedKmh?.toFixed(1) ?? '–';
    $('bhr').textContent = p.hr?.toString() ?? '–';
    // Nicht jede Messung protokollieren: bei Sprung >= 10 W oder einmal je 5 s
    const sec = Math.floor(performance.now() / 5000);
    if (p.power !== undefined && (lastPower === undefined || Math.abs(p.power - lastPower) >= 10 || sec !== lastLogSecond)) {
      lastPower = p.power;
      lastLogSecond = sec;
      log('bike.data', { ...p, raw: hex(d) });
    }
  });
  await data.startNotifications();

  ctrl = await svc.getCharacteristic(CH.control);
  ctrl.addEventListener('characteristicvaluechanged', (ev) =>
    log('bike.controlResponse', hex((ev.target as BluetoothRemoteGATTCharacteristic).value!)));
  await ctrl.startNotifications(); // Indications
  for (const [id, label] of [[CH.status, 'bike.status'], [CH.training, 'bike.training']] as const) {
    try {
      const c = await svc.getCharacteristic(id);
      c.addEventListener('characteristicvaluechanged', (ev) =>
        log(label, hex((ev.target as BluetoothRemoteGATTCharacteristic).value!)));
      await c.startNotifications();
    } catch (e) { log(label + '.fehler', String(e)); }
  }
  log('bike.bereit');
}

$('bikeConnect').onclick = async () => {
  try {
    bike = await navigator.bluetooth.requestDevice({
      filters: [{ services: [FTMS] }],
      optionalServices: [FTMS, 0x1818, 0x180d],
    });
    bike.addEventListener('gattserverdisconnected', () => log('bike.getrennt'));
    await setupBike(bike);
  } catch (e) { log('bike.fehler', String(e)); }
};
$('bikeReconnect').onclick = async () => {
  if (!bike) return log('bike.neuverbinden', 'kein Gerät bekannt');
  const t = performance.now();
  try {
    await setupBike(bike);
    log('bike.neuverbunden', { ms: Math.round(performance.now() - t) });
  } catch (e) { log('bike.neuverbinden.fehler', String(e)); }
};
$('bikeDisconnect').onclick = () => { bike?.gatt?.disconnect(); };

async function cp(op: number, payload: number[] = []) {
  if (!ctrl) return log('control.fehler', 'nicht verbunden');
  const bytes = new Uint8Array([op, ...payload]);
  log('control.send', hex(new DataView(bytes.buffer)));
  try { await ctrl.writeValueWithResponse(bytes); } catch (e) { log('control.fehler', String(e)); }
}
$('reqCtrl').onclick = () => cp(0x00);
$('start').onclick = () => cp(0x07);
$('pause').onclick = () => cp(0x08, [2]);
$('stop').onclick = () => cp(0x08, [1]);
$('reset').onclick = () => cp(0x01);
$('setTarget').onclick = () => {
  const w = parseInt(($('target') as HTMLInputElement).value, 10);
  cp(0x05, [w & 0xff, (w >> 8) & 0xff]);
};
$('addNote').onclick = () => {
  const i = $('note') as HTMLInputElement;
  log('NOTIZ', i.value);
  i.value = '';
};

// ---------- Pulsgurt ----------
let lastHrSecond = -1;
$('hrConnect').onclick = async () => {
  try {
    const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: [0x180d] }] });
    dev.addEventListener('gattserverdisconnected', () => log('hr.getrennt'));
    const srv = await dev.gatt!.connect();
    const c = await (await srv.getPrimaryService(0x180d)).getCharacteristic(0x2a37);
    c.addEventListener('characteristicvaluechanged', (ev) => {
      const d = (ev.target as BluetoothRemoteGATTCharacteristic).value!;
      const hr = d.getUint8(0) & 1 ? d.getUint16(1, true) : d.getUint8(1);
      $('hr').textContent = String(hr);
      const sec = Math.floor(performance.now() / 5000);
      if (sec !== lastHrSecond) { lastHrSecond = sec; log('hr.data', { hr, raw: hex(d) }); }
    });
    await c.startNotifications();
    log('hr.bereit', { name: dev.name });
  } catch (e) { log('hr.fehler', String(e)); }
};

// ---------- intervals.icu ----------
const base = 'https://intervals.icu/api/v1';
const auth = () => 'Basic ' + btoa('API_KEY:' + ($('key') as HTMLInputElement).value);
const ath = () => ($('ath') as HTMLInputElement).value || '0';

$('icuEvents').onclick = async () => {
  const days = parseInt(($('days') as HTMLInputElement).value, 10) || 14;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const url = `${base}/athlete/${ath()}/events?oldest=${iso(new Date())}&newest=${iso(new Date(Date.now() + days * 864e5))}`;
  try {
    const r = await fetch(url, { headers: { Authorization: auth() } });
    log('icu.events.status', { status: r.status, ok: r.ok });
    const text = await r.text();
    try {
      const j = JSON.parse(text) as any[];
      log('icu.events.anzahl', j.length);
      for (const e of j) {
        log('icu.event', {
          id: e.id, name: e.name, type: e.type, category: e.category, start: e.start_date_local,
          hat_workout_doc: !!e.workout_doc, felder: Object.keys(e),
        });
        if (e.workout_doc) log('icu.event.workout_doc', e.workout_doc);
      }
    } catch { log('icu.events.rohtext', text.slice(0, 500)); }
  } catch (e) { log('icu.events.fehler(CORS?)', String(e)); }
};

$('icuUpload').onclick = async () => {
  const f = ($('fit') as HTMLInputElement).files?.[0];
  if (!f) return log('icu.upload', 'keine Datei gewählt');
  const fd = new FormData();
  fd.append('file', f, f.name);
  try {
    const r = await fetch(`${base}/athlete/${ath()}/activities`, { method: 'POST', headers: { Authorization: auth() }, body: fd });
    log('icu.upload.status', { status: r.status, body: (await r.text()).slice(0, 500) });
  } catch (e) { log('icu.upload.fehler(CORS?)', String(e)); }
};

$('dl').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(entries, null, 1)], { type: 'application/json' }));
  a.download = `m0-protokoll-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
};
log('spike.gestartet', { ua: navigator.userAgent, bluetooth: !!navigator.bluetooth, secure: isSecureContext });
