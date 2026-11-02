const { app, BrowserWindow, nativeTheme, nativeImage } = require('electron');
const path = require('path');

if (!app.requestSingleInstanceLock()) app.quit();

function createWindow() {
  const mac = process.platform === 'darwin';
  const win = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 380,
    minHeight: 520,
    show: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 22, y: 20 },
    // macOS : fond translucide (vibrancy), l'interface laisse passer un voile du bureau
    ...(mac ? { vibrancy: 'under-window', visualEffectState: 'followWindow', backgroundColor: '#00000000' }
            : { backgroundColor: nativeTheme.shouldUseDarkColors ? '#0E0E0E' : '#FBFBFA' }),
    webPreferences: { contextIsolation: true, sandbox: true }
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'web', 'index.html'));
  return win;
}

app.whenReady().then(() => {
  // icône du Dock pendant `npm start` (le .dmg embarque la sienne)
  if (app.dock) app.dock.setIcon(nativeImage.createFromPath(path.join(__dirname, 'web', 'icon-1024.png')));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  const w = BrowserWindow.getAllWindows()[0];
  if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
