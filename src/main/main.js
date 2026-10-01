const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, nativeImage, screen, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let isResting = false;

// Create transparent, frameless window
function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const winWidth = 480;
  const winHeight = 720;

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: Math.max(0, screenWidth - winWidth - 30),
    y: Math.max(0, screenHeight - winHeight - 10),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Allow loading local VRM models and audio blobs
    }
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const filename = sourceId ? sourceId.split('/').pop() : 'inline';
    console.log(`[Renderer] ${message} (${filename}:${line})`);
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Generate simple in-memory heart icon for system tray
function createHeartTrayIcon() {
  const size = 16;
  const canvasBuffer = Buffer.alloc(size * size * 4);
  // Fill heart shape pixels
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Simple heart equation: (x^2 + y^2 - 1)^3 - x^2 * y^3 <= 0 normalized
      const nx = (x - 7.5) / 5.5;
      const ny = -(y - 7.5) / 5.5;
      const heartEquation = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * Math.pow(ny, 3);
      if (heartEquation <= 0.05) {
        canvasBuffer[idx] = 244;     // R
        canvasBuffer[idx + 1] = 63;  // G
        canvasBuffer[idx + 2] = 142; // B
        canvasBuffer[idx + 3] = 255; // A
      } else {
        canvasBuffer[idx + 3] = 0;   // Transparent
      }
    }
  }
  return nativeImage.createFromBuffer(canvasBuffer, { width: size, height: size });
}

// Setup System Tray
function createTray() {
  const icon = createHeartTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('3D 桌面 AI 女友');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '喚醒小櫻 (Wake Up)',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('action:return');
          mainWindow.show();
        }
      }
    },
    {
      label: '休息 / 離開 (Rest)',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('action:leave');
        }
      }
    },
    {
      label: '切換全身/半身視角 (Toggle View)',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('action:toggle-view');
        }
      }
    },
    { type: 'separator' },
    {
      label: '換裝與角色 (Costumes & Characters)',
      submenu: [
        { label: '日常休閒 (Casual)', click: () => sendCostume('casual') },
        { label: '青春水手服 (School)', click: () => sendCostume('school') },
        { label: '優雅時尚裝 (Stylish)', click: () => sendCostume('stylish') },
        { label: '哥德蘿莉裝 (Gothic)', click: () => sendCostume('gothic') },
        { label: '未來科技裝 (Seed)', click: () => sendCostume('seed') },
        { label: '百鬼綾目 (Ayame)', click: () => sendCostume('ayame') },
        { label: '泳裝薄荷 (Mint)', click: () => sendCostume('mint') }
      ]
    },
    {
      label: '設定 (Settings)',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('ui:open-settings');
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出程式 (Quit)',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.webContents.send('action:return');
      } else {
        mainWindow.show();
      }
    }
  });
}

function sendCostume(name) {
  if (mainWindow) {
    mainWindow.webContents.send('action:costume', name);
  }
}

// Global shortcut registration
function registerShortcuts() {
  globalShortcut.register('CommandOrControl+Alt+G', () => {
    if (mainWindow) {
      isResting = !isResting;
      if (isResting) {
        mainWindow.webContents.send('action:leave');
      } else {
        mainWindow.webContents.send('action:return');
        mainWindow.show();
      }
    }
  });
}

let isFullscreenCanvas = false;
let lastWindowBounds = null;

// IPC Handlers
ipcMain.on('window:move', (event, { mouseX, mouseY }) => {
  if (!mainWindow || isFullscreenCanvas) return;
  const { x, y } = mainWindow.getBounds();
  mainWindow.setPosition(x + mouseX, y + mouseY);
});

ipcMain.handle('window:toggle-fullscreen', () => {
  if (!mainWindow) return false;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  isFullscreenCanvas = !isFullscreenCanvas;
  if (isFullscreenCanvas) {
    lastWindowBounds = mainWindow.getBounds();
    mainWindow.setBounds({ x: 0, y: 0, width: screenWidth, height: screenHeight });
  } else {
    const fallbackBounds = {
      width: 480,
      height: 720,
      x: Math.max(0, screenWidth - 480 - 30),
      y: Math.max(0, screenHeight - 720 - 10)
    };
    mainWindow.setBounds(lastWindowBounds || fallbackBounds);
  }
  return isFullscreenCanvas;
});

ipcMain.on('window:set-ignore-mouse-events', (event, { ignore, forward }) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: forward !== false });
  }
});

ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('window:set-resting-mode', (event, resting) => {
  isResting = resting;
  if (!mainWindow) return;
  // If resting, allow shrinking or keeping heart widget in corner
});

ipcMain.on('app:set-startup', (event, enable) => {
  app.setLoginItemSettings({
    openAtLogin: enable,
    path: app.getPath('exe')
  });
});

ipcMain.handle('app:save-snapshot', async (event, { dataUrl, filename }) => {
  try {
    const picturesDir = path.join(app.getPath('pictures'), 'aibff_snapshots');
    if (!fs.existsSync(picturesDir)) {
      fs.mkdirSync(picturesDir, { recursive: true });
    }
    const filePath = path.join(picturesDir, filename);
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    console.log(`[Main] Saved snapshot successfully to: ${filePath}`);
    return { success: true, filePath, filename };
  } catch (err) {
    console.error('[Main] Failed to save snapshot:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('app:open-path', async (event, targetPath) => {
  try {
    if (fs.existsSync(targetPath)) {
      shell.showItemInFolder(targetPath);
      return { success: true };
    }
    return { success: false, error: 'Path not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

app.whenReady().then(() => {
  // Grant media permission automatically for microphone recording
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      return callback(true);
    }
    callback(true);
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media') {
      return true;
    }
    return true;
  });

  createWindow();
  createTray();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
