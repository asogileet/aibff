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
        if (window.appControllers?.avatarManager?.getActiveVRM() && window.appControllers?.mascotPhysicsController) {
          clearInterval(check);
          resolve();
        }
      }, 150);
      setTimeout(resolve, 10000);
    })
  `);

  console.log('[Test] Verifying Camera Stability and Patrol Visibility...');

  const results = await win.webContents.executeJavaScript(`
    (async () => {
      const tests = [];
      const am = window.appControllers.avatarManager;
      const sm = window.appControllers.sceneManager;
      const physics = window.appControllers.mascotPhysicsController;
      const anim = window.appControllers.animationController;

      // 1. Camera Stability Test: Wait 3 seconds and ensure cameraY does not diverge
      const initialCamY = sm.camera.position.y;
      await new Promise(r => setTimeout(r, 2000));
      const settledCamY = sm.camera.position.y;
      const camStable = Math.abs(settledCamY - initialCamY) < 0.25 && Math.abs(settledCamY - 1.25) < 0.35;

      tests.push({
        name: '1. Camera Exponential Damping Stability',
        pass: camStable,
        detail: \`Initial CamY: \${initialCamY.toFixed(2)}, After 2s: \${settledCamY.toFixed(2)} (Target: ~1.25m)\`
      });

      // 2. Patrol Run Visibility & Boundary Movement Test
      const slot = am.getActiveSlot();
      physics.togglePatrol(0); // Start patrol
      await new Promise(r => setTimeout(r, 2000)); // Let run for 2s

      const afterPatrolPos = slot.vrm.scene.position;
      const afterPatrolCamY = sm.camera.position.y;
      const isVisible = slot.vrm.scene.visible;
      // In frustum check: x within [-1.5, 1.5], y around 0, camY around 1.25
      const inView = Math.abs(afterPatrolPos.x) < 1.0 && Math.abs(afterPatrolCamY - 1.25) < 0.35 && isVisible;

      tests.push({
        name: '2. Patrol Roaming Avatar Stays In Screen View',
        pass: inView,
        detail: \`Avatar Pos: (X:\${afterPatrolPos.x.toFixed(2)}, Y:\${afterPatrolPos.y.toFixed(2)}), CamY: \${afterPatrolCamY.toFixed(2)}, Visible: \${isVisible}\`
      });

      // Stop patrol
      physics.togglePatrol(0);

      // 3. ActionSelector In-Place Run Test
      anim.playRun();
      await new Promise(r => setTimeout(r, 1500));
      const afterActionCamY = sm.camera.position.y;
      const afterActionPos = slot.vrm.scene.position;
      const actionInView = Math.abs(afterActionCamY - 1.25) < 0.35 && isVisible;

      tests.push({
        name: '3. In-Place Run Animation Stability',
        pass: actionInView,
        detail: \`CamY: \${afterActionCamY.toFixed(2)}, Avatar Y: \${afterActionPos.y.toFixed(2)}, Visible: \${isVisible}\`
      });

      anim.resetToIdle();
      return tests;
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
    console.log('🎉 PATROL STABILITY VERIFIED SUCCESSFULLY!\n');
    app.exit(0);
  } else {
    console.error('❌ STABILITY TEST FAILED.\n');
    app.exit(1);
  }
});
