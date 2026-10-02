const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('force-device-scale-factor', '1');

app.whenReady().then(async () => {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const minX = Math.min(...displays.map(d => d.bounds.x));
  const minY = Math.min(...displays.map(d => d.bounds.y));
  const maxX = Math.max(...displays.map(d => d.bounds.x + d.bounds.width));
  const maxY = Math.max(...displays.map(d => d.bounds.y + d.bounds.height));

  const multiBounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  const primaryRelative = {
    offsetX: primary.bounds.x - minX,
    offsetY: primary.bounds.y - minY,
    width: primary.bounds.width,
    height: primary.bounds.height
  };

  let win = null;

  const getCleanLayout = () => JSON.parse(JSON.stringify({
    bounds: multiBounds,
    primary: primaryRelative,
    displays: displays.map(d => ({ x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height }))
  }));

  ipcMain.handle('window:get-display-layout', () => getCleanLayout());

  let isFullscreen = false;
  ipcMain.handle('window:toggle-fullscreen', () => {
    isFullscreen = !isFullscreen;
    if (isFullscreen && win) {
      win.setBounds(multiBounds);
      win.webContents.send('window:display-metrics-changed', getCleanLayout());
    } else if (win) {
      win.setBounds({ width: 480, height: 720, x: 100, y: 100 });
      win.webContents.send('window:display-metrics-changed', null);
    }
    return Boolean(isFullscreen);
  });

  win = new BrowserWindow({
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

  console.log('[Test] Waiting for scene and avatar to load...');
  await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.appControllers && window.appControllers.sceneManager && window.appControllers.mascotPhysicsController) {
          clearInterval(check);
          resolve();
        }
      }, 150);
      setTimeout(() => { clearInterval(check); resolve(); }, 15000);
    })
  `);

  console.log('[Test] Running Floor Framing & Horizontal Boundary Verifications...');

  const results = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        const tests = [];
        const sm = window.appControllers.sceneManager;
        const physics = window.appControllers.mascotPhysicsController;
        const am = window.appControllers.avatarManager;

        // 1. Switch to Fullscreen and Verify Full-Body Camera Framing
        await window.electronAPI.toggleFullscreen();
        await new Promise(r => setTimeout(r, 600));

        const isFullPreset = Math.abs(sm.targetPanY - 0.72) < 0.05 && Math.abs(sm.targetCameraDist - 3.3) < 0.1;
        tests.push({
          name: '1. Fullscreen mode automatically activates Full-Body Camera Framing',
          pass: isFullPreset,
          detail: 'targetPanY: ' + sm.targetPanY.toFixed(2) + 'm (Target: ~0.72m), targetCameraDist: ' + sm.targetCameraDist.toFixed(2) + 'm (Target: ~3.3m)'
        });

        // 2. Floor Level Visibility: Ensure floor level (0.0m) is comfortably above screen bottom edge
        const vFov = (sm.camera.fov * Math.PI) / 180;
        const visibleH = 2 * Math.tan(vFov / 2) * sm.targetCameraDist;
        const bottomY = sm.targetPanY - visibleH / 2;
        const floorClearance = 0.0 - bottomY;
        const floorVisibleAboveBottom = floorClearance > 0.05 && floorClearance < 0.40;
        tests.push({
          name: '2. Floor level (0.0m) rests safely above screen bottom taskbar area',
          pass: floorVisibleAboveBottom,
          detail: 'Floor Clearance Above Bottom: ' + floorClearance.toFixed(2) + 'm (Screen Bottom Y: ' + bottomY.toFixed(2) + 'm, Visible Height: ' + visibleH.toFixed(2) + 'm)'
        });

        // 3. Fall Boundary Bounce Test: Throw avatar leftward towards outer boundary
        const slot = am ? am.getActiveSlot() : null;
        if (slot && slot.vrm && slot.vrm.scene) {
          slot.vrm.scene.position.set(-2.0, 1.5, 0.0);
          slot.velocity.set(-6.0, 0.0, 0.0);
          slot.physicsState = 'falling';

          for (let i = 0; i < 24; i++) {
            physics.update(0.016);
          }

          const cam = sm.camera;
          const dist = Math.abs(cam.position.z - slot.vrm.scene.position.z);
          const visibleW = 2 * Math.tan(vFov / 2) * dist * cam.aspect;
          const halfW = visibleW / 2;
          const safeMargin = Math.min(halfW * 0.35, 0.45 * (slot.scale || 1.0));
          const minX = cam.position.x - halfW + safeMargin;

          const bouncedRight = slot.velocity.x >= 0;
          const stayedInside = slot.vrm.scene.position.x >= minX - 0.05;
          tests.push({
            name: '3. Horizontal toss wall bounce prevents avatar flying out of screen',
            pass: bouncedRight && stayedInside,
            detail: 'Velocity.x after bounce: ' + slot.velocity.x.toFixed(2) + 'm/s (Positive), Avatar X: ' + slot.vrm.scene.position.x.toFixed(2) + 'm (minX: ' + minX.toFixed(2) + 'm)'
          });

          slot.vrm.scene.position.set(0.0, 0.0, 0.0);
          slot.velocity.set(0, 0, 0);
          slot.physicsState = 'idle';
        }

        // 4. Toolbar taskbar clearance test
        const bottomToolbar = document.getElementById('bottomToolbar');
        const isElevated = bottomToolbar && bottomToolbar.style.bottom === '52px';
        tests.push({
          name: '4. Bottom toolbar elevated to 52px avoiding Windows taskbar overlap',
          pass: !!isElevated,
          detail: 'Toolbar style.bottom: ' + (bottomToolbar ? bottomToolbar.style.bottom : 'null')
        });

        return tests;
      } catch (err) {
        return [{ name: 'Execution error: ' + err.message, pass: false, detail: err.stack }];
      }
    })();
  `);

  console.log('\n================ TEST RESULTS ================');
  let allPassed = true;
  results.forEach(t => {
    const mark = t.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${t.name}]`);
    console.log(`   Detail: ${t.detail}`);
    if (!t.pass) allPassed = false;
  });
  console.log('==============================================');

  if (allPassed) {
    console.log('🎉 FLOOR & BOUNDARY FIX VERIFIED SUCCESSFULLY!\n');
    app.exit(0);
  } else {
    console.error('❌ VERIFICATION FAILED.\n');
    app.exit(1);
  }
});
