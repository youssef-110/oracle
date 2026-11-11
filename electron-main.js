/**
 * Oracle — Electron main process
 * Runs the Express backend in-process and opens the UI as a desktop window.
 *
 * Desktop-only powers used here:
 *  - setDisplayMediaRequestHandler: grants screen capture automatically,
 *    so there is no browser share-picker dialog.
 *  - setContentProtection: excludes the Oracle window itself from the
 *    captures, so the AI never comments on its own UI.
 */

const { app, BrowserWindow, session, desktopCapturer, screen } = require('electron');
const { startServer, PORT } = require('./server');

let win = null;

async function pickPrimaryScreenSource() {
  const sources = await desktopCapturer.getSources({ types: ['screen'] });
  const primaryId = String(screen.getPrimaryDisplay().id);
  return sources.find((s) => s.display_id === primaryId) || sources[0];
}

async function createWindow() {
  await startServer();

  /* Auto-grant screen capture with the primary display — no picker. */
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const source = await pickPrimaryScreenSource();
      callback(source ? { video: source } : {});
    } catch (err) {
      console.error('[Oracle] Screen capture grant failed:', err);
      callback({});
    }
  });

  win = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 900,
    minHeight: 620,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0f',
    title: 'Oracle',
    show: false
  });

  /* Keep Oracle out of its own screenshots (Windows 10 2004+). */
  win.setContentProtection(true);

  win.once('ready-to-show', () => win.show());
  win.loadURL(`http://127.0.0.1:${PORT}`);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => app.quit());

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
