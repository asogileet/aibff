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

  console.log('[Test] Running Wheel Zoom Limits & Multi-Monitor Floor Stepping Tests...');

  const results = await win.webContents.executeJavaScript(`
    (async () => {
      try {
        const tests = [];
        const sm = window.appControllers.sceneManager;
        const physics = window.appControllers.mascotPhysicsController;
        const am = window.appControllers.avatarManager;

        // 1. Enter Fullscreen and Pass Layout
        await window.electronAPI.toggleFullscreen();
        await new Promise(r => setTimeout(r, 600));

        // Test 1: Camera zoom limits safe boundaries
        const minDistSafe = sm.minDist >= 1.5;
        const maxDistSafe = sm.maxDist <= 5.0;
        tests.push({
          name: '1. Camera zoom limits prevent model penetration (minDist >= 1.5m, maxDist <= 5.0m)',
          pass: minDistSafe && maxDistSafe,
          detail: 'sm.minDist: ' + sm.minDist + 'm, sm.maxDist: ' + sm.maxDist + 'm'
        });

        // Test 2: Avatar scaling on wheel without TypeError
        const curScale = am.getScale(0);
        am.setScale(0, curScale + 0.1);
        const newScale = am.getScale(0);
        const scaleWorks = Math.abs(newScale - (curScale + 0.1)) < 0.01;
        tests.push({
          name: '2. Avatar scaling logic executes cleanly without TypeError',
          pass: scaleWorks,
          detail: 'Previous Scale: ' + curScale.toFixed(2) + ', New Scale: ' + newScale.toFixed(2)
        });

        // Test 3: Multi-monitor adaptive floor heights (left monitor should have higher floor than center 1600p monitor)
        const centerFloor = physics.getFloorYAt(0.0);
        const leftFloor = physics.getFloorYAt(-2.5);
        const rightFloor = physics.getFloorYAt(2.5);

        const floorAdapts = leftFloor > centerFloor + 0.2;
        tests.push({
          name: '3. Adaptive floor height elevates floor on 1080p side monitors preventing void drop',
          pass: floorAdapts,
          detail: 'Center Floor Y: ' + centerFloor.toFixed(2) + 'm, Left (1080p) Floor Y: ' + leftFloor.toFixed(2) + 'm, Right Floor Y: ' + rightFloor.toFixed(2) + 'm'
        });

        // Test 4: Z-axis strictly locked to 0 during patrol and falling
        const slot = am.getActiveSlot();
        if (slot && slot.vrm && slot.vrm.scene) {
          slot.vrm.scene.position.set(0, 1.0, 0.5); // Intentionally introduce Z offset
          slot.velocity.set(0, -2.0, 1.0);
          slot.physicsState = 'falling';

          for (let i = 0; i < 20; i++) {
            physics.update(0.016);
          }

          const zLocked = Math.abs(slot.vrm.scene.position.z) < 0.001;
          tests.push({
            name: '4. Z-axis strictly locked to 0 in 2.5D plane preventing diagonal disappearance',
            pass: zLocked,
            detail: 'Avatar Z position after physics step: ' + slot.vrm.scene.position.z.toFixed(4) + 'm (Target: 0.0m)'
          });

          slot.vrm.scene.position.set(0, 0, 0);
          slot.velocity.set(0, 0, 0);
          slot.physicsState = 'idle';
        }

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
    console.log('🎉 WHEEL & STEPPING FIX VERIFIED SUCCESSFULLY!\n');
    app.exit(0);
  } else {
    console.error('❌ VERIFICATION FAILED.\n');
    app.exit(1);
  }
});
