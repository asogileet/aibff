const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 480,
    height: 720,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../src/main/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  });

  win.webContents.on('console-message', (event, level, message) => {
    if (!message.includes('attempts to index') && !message.includes('Missing min/max properties') && !message.includes('Electron Security Warning')) {
      console.log(`[Renderer] ${message}`);
    }
  });

  await win.loadFile(path.join(__dirname, '../src/renderer/index.html'));

  console.log('[Test] Waiting for scene and avatar initialization...');
  await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.appControllers?.sceneManager && window.appControllers?.avatarManager?.getActiveVRM()) {
          clearInterval(check);
          resolve();
        }
      }, 150);
      setTimeout(resolve, 10000);
    })
  `);

  console.log('[Test] Executing Vanishing Point & Perspective Tests...');

  const results = await win.webContents.executeJavaScript(`
    (async () => {
      const tests = [];
      const sm = window.appControllers.sceneManager;

      // 1. SceneManager FOV & Vanishing Point Methods
      sm.setFov(60, true);
      const fovApplied = Math.abs(sm.camera.fov - 60) < 0.1 && sm.targetFov === 60;
      tests.push({
        name: '1. SceneManager setFov',
        pass: fovApplied,
        detail: \`targetFov: \${sm.targetFov}, camera.fov: \${sm.camera.fov}\`
      });

      sm.setVanishingPoint(0.2, -0.4, true);
      const vpApplied = sm.targetVpOffsetX === 0.2 && sm.targetVpOffsetY === -0.4 && sm.camera.view !== null;
      tests.push({
        name: '2. SceneManager setVanishingPoint (Off-Axis View Offset)',
        pass: vpApplied,
        detail: \`targetVpOffsetX: \${sm.targetVpOffsetX}, targetVpOffsetY: \${sm.targetVpOffsetY}, camera.view: \${Boolean(sm.camera.view)}\`
      });

      // 3. Preset Application
      sm.setPerspectivePreset('anime', true);
      const state = sm.getPerspectiveState();
      const animePresetPass = state.fov === 65 && Math.abs(state.vpOffsetY - (-0.45)) < 0.01;
      tests.push({
        name: '3. SceneManager setPerspectivePreset("anime")',
        pass: animePresetPass,
        detail: \`FOV: \${state.fov}, vpOffsetY: \${state.vpOffsetY}\`
      });

      // 4. Ground Grid Helper
      sm.setGridVisible(true);
      sm.setGridStyle('cyber');
      const gridPass = sm.isGridVisible === true && sm.gridStyle === 'cyber' && sm.gridGroup.visible === true;
      tests.push({
        name: '4. Ground Perspective Grid Helper & Cyber Style',
        pass: gridPass,
        detail: \`isGridVisible: \${sm.isGridVisible}, gridStyle: \${sm.gridStyle}, gridGroup.visible: \${sm.gridGroup?.visible}\`
      });

      // 5. Vanishing Point 2D Screen Coordinates Calculation
      const screenCoords = sm.getVanishingPointScreenCoords();
      const coordsPass = typeof screenCoords.x === 'number' && typeof screenCoords.y === 'number' && screenCoords.x > 0 && screenCoords.y > 0;
      tests.push({
        name: '5. Vanishing Point Screen Coordinates Calculation',
        pass: coordsPass,
        detail: \`ScreenCoords: (\${screenCoords.x.toFixed(1)}, \${screenCoords.y.toFixed(1)})\`
      });

      // 6. SettingsModal UI Controls & Real-Time Sync
      const settingsModalEl = document.getElementById('settingsModal');
      const rngFov = settingsModalEl.querySelector('#cfgFov');
      const rngVpX = settingsModalEl.querySelector('#cfgVpX');
      const rngVpY = settingsModalEl.querySelector('#cfgVpY');
      const chkGrid = settingsModalEl.querySelector('#cfgShowGrid');
      const selGridStyle = settingsModalEl.querySelector('#cfgGridStyle');

      // Simulate user sliding FOV
      rngFov.value = 50;
      rngFov.dispatchEvent(new Event('input'));
      const fovSync = sm.targetFov === 50;

      // Simulate user sliding VP X and Y
      rngVpX.value = -0.3;
      rngVpX.dispatchEvent(new Event('input'));
      rngVpY.value = 0.5;
      rngVpY.dispatchEvent(new Event('input'));
      const vpSync = Math.abs(sm.targetVpOffsetX - (-0.3)) < 0.01 && Math.abs(sm.targetVpOffsetY - 0.5) < 0.01;

      // Simulate preset button click
      const btnPresetStd = settingsModalEl.querySelector('#btnPresetStd');
      btnPresetStd.dispatchEvent(new Event('click'));
      const presetBtnSync = sm.targetFov === 30 && sm.targetVpOffsetX === 0 && sm.targetVpOffsetY === 0;

      tests.push({
        name: '6. SettingsModal Controls & Real-Time Sync',
        pass: fovSync && vpSync && presetBtnSync,
        detail: \`fovSync: \${fovSync}, vpSync: \${vpSync}, presetBtnSync: \${presetBtnSync}\`
      });

      // 7. Slash Commands Test via ChatBox
      const chatInput = document.getElementById('chatInput');
      const btnSend = document.getElementById('btnSendChat');

      // Test /fov 42
      chatInput.value = '/fov 42';
      btnSend.click();
      await new Promise(r => setTimeout(r, 100));
      const slashFovPass = sm.targetFov === 42;

      // Test /vp 0.15 -0.25
      chatInput.value = '/vp 0.15 -0.25';
      btnSend.click();
      await new Promise(r => setTimeout(r, 100));
      const slashVpPass = Math.abs(sm.targetVpOffsetX - 0.15) < 0.01 && Math.abs(sm.targetVpOffsetY - (-0.25)) < 0.01;

      // Test /grid toggle
      const initialGrid = sm.isGridVisible;
      chatInput.value = '/grid';
      btnSend.click();
      await new Promise(r => setTimeout(r, 100));
      const slashGridPass = sm.isGridVisible !== initialGrid;

      tests.push({
        name: '7. Slash Commands (/fov, /vp, /grid)',
        pass: slashFovPass && slashVpPass && slashGridPass,
        detail: \`slashFov: \${slashFovPass}, slashVp: \${slashVpPass}, slashGrid: \${slashGridPass}\`
      });

      // 8. Configuration Persistence Test
      const saveBtn = settingsModalEl.querySelector('#btnSaveSettings');
      saveBtn.click();
      await new Promise(r => setTimeout(r, 200));
      const cached = localStorage.getItem('aibff_camera_perspective');
      const persistencePass = cached !== null && typeof JSON.parse(cached) === 'object';
      tests.push({
        name: '8. Camera Perspective Persistence in localStorage',
        pass: persistencePass,
        detail: \`Cached Config: \${cached}\`
      });

      return tests;
    })();
  `);

  console.log('\n================ TEST SUMMARY ================');
  let allPass = true;
  for (const t of results) {
    const status = t.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${t.name}`);
    console.log(`    Detail: ${t.detail}`);
    if (!t.pass) allPass = false;
  }
  console.log('==============================================\n');

  win.close();
  app.exit(allPass ? 0 : 1);
});
