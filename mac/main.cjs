// Mac-Hülle für Pedalo: zeigt die gebaute Web-App in einem eigenen Fenster und ersetzt das Bluetooth-Auswahlfenster
// von Chrome, das in Electron fehlt. Die App selbst (dist/) bleibt unverändert.
const { app, BrowserWindow, dialog, net, powerSaveBlocker, protocol, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SCHEME = 'pedalo';
const root = path.join(__dirname, 'dist');

// Eigenes, „sicheres“ Schema: Web Bluetooth und IndexedDB brauchen einen sicheren Ursprung, file:// genügt nicht.
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

if (!process.env.PEDALO_NO_LOCK && !app.requestSingleInstanceLock()) app.quit();

/** Bluetooth-Auswahl: sammelt gefundene Geräte einige Sekunden und lässt dann im Dialog wählen. */
function makeChooser(win) {
  let active = null; // { devices, callback, timer, waited }
  const finish = (id) => {
    if (!active) return;
    const { callback } = active;
    clearTimeout(active.timer);
    active = null;
    callback(id);
  };
  const show = async () => {
    const cur = active;
    if (!cur) return;
    if (cur.devices.length === 0) {
      cur.waited += 1;
      if (cur.waited > 8) return finish(''); // nach etwa 30 s ohne Gerät abbrechen
      cur.timer = setTimeout(show, 3500);
      return;
    }
    const list = cur.devices;
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      message: 'Gerät auswählen',
      detail: 'Gefundene Bluetooth-Geräte. Fehlt deines, kurbele kurz, um es zu wecken, und wähle „Abbrechen“ und dann erneut „Koppeln“.',
      buttons: [...list.map((d) => d.deviceName || `Gerät ${d.deviceId.slice(0, 8)}`), 'Abbrechen'],
      cancelId: list.length,
      defaultId: 0,
    });
    finish(response < list.length ? list[response].deviceId : '');
  };
  return (event, devices, callback) => {
    event.preventDefault();
    if (!active) {
      active = { devices, callback, timer: setTimeout(show, 3500), waited: 0 };
    } else {
      active.devices = devices;
      active.callback = callback;
    }
  };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    backgroundColor: '#0b0b0d',
    title: 'Pedalo',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.on('select-bluetooth-device', makeChooser(win));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`${SCHEME}://`)) return { action: 'allow' };
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  void win.loadURL(`${SCHEME}://app/index.html`);
  return win;
}

app.whenReady().then(() => {
  protocol.handle(SCHEME, (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(root, p));
    if (!file.startsWith(root)) return new Response('Nicht erlaubt', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  // Der Bildschirm soll während des Trainings an bleiben.
  powerSaveBlocker.start('prevent-display-sleep');
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
