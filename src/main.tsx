import { render } from 'preact';
import { Controller } from './app/controller';
import { IdbStore } from './app/idb';
import { createLogger, loggedTrainer } from './app/debuglog';
import { BrowserWakeLock } from './app/wakelock';
import { Library } from './domain/library';
import { ProfileStore } from './domain/profile';
import { BleHeartRate, FtmsTrainer } from './devices/webbluetooth';
import { IcuClient } from './icu/client';
import { systemClock } from './ports';
import { App } from './ui/App';
import './ui/styles.css';

const log = createLogger(import.meta.env.DEV);
const kv = new IdbStore('pedalo');
const ftms = new FtmsTrainer();
ftms.log = log;
const controller = new Controller({
  profiles: new ProfileStore(kv),
  library: new Library(kv),
  recStore: kv,
  trainer: loggedTrainer(ftms, log),
  hr: new BleHeartRate(),
  wake: new BrowserWakeLock(),
  log,
  clock: systemClock,
  makeIcu: (acc) => new IcuClient(acc),
  saveFile: (bytes, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/octet-stream' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  },
});

// Zwischengespeichertes vor dem Schließen des Tabs sichern (die Aufzeichnung schreibt ohnehin alle 5 s).
render(<App c={controller} />, document.getElementById('app')!);
void controller.init();

// Offline-Start als installierte App (nicht im Entwicklungsmodus und nicht unter Testautomatisierung).
if (import.meta.env.PROD && 'serviceWorker' in navigator && !navigator.webdriver) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Offline-Start nicht verfügbar', e));
}
