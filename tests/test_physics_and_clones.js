const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false, // Headless testing
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

  console.log('[Test] Waiting for VRM and Physics controllers to initialize...');

  // Wait for controllers to initialize
  await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.appControllers && window.appControllers.avatarManager?.getActiveVRM() && window.appControllers.mascotPhysicsController) {
          clearInterval(check);
          resolve();
        }
      }, 150);
      setTimeout(() => { clearInterval(check); resolve(); }, 15000);
    })
  `);

  console.log('[Test] Running Shadow Clone & Physics Verifications...');

  const results = await win.webContents.executeJavaScript(`
    (async () => {
      const tests = [];
      const am = window.appControllers.avatarManager;
      const physics = window.appControllers.mascotPhysicsController;
      const barEl = document.getElementById('multiAvatarBar');

      // 1. Verify Primary Avatar Scale & Clamping
      try {
        const initialScale = am.getScale(0);
        am.setScale(0, 1.6);
        const updatedScale = am.getScale(0);
        const sceneScale = am.getActiveVRM().scene.scale.x;

        // Test boundary clamping
        am.setScale(0, 0.1);
        const clampedMin = am.getScale(0);
        am.setScale(0, 5.0);
        const clampedMax = am.getScale(0);

        // Reset to normal
        am.setScale(0, 1.2);

        tests.push({
          name: '1. Primary Avatar Scaling & Clamping',
          pass: initialScale === 1.0 && updatedScale === 1.6 && Math.abs(sceneScale - 1.6) < 0.01 && clampedMin >= 0.3 && clampedMax <= 3.0,
          detail: \`Init: \${initialScale}, Set 1.6: \${updatedScale} (scene: \${sceneScale.toFixed(2)}), Clamped: [\${clampedMin}, \${clampedMax}]\`
        });
      } catch (err) {
        tests.push({ name: '1. Primary Avatar Scaling & Clamping', pass: false, detail: err.message });
      }

      // 2. Verify Spawning Clone with Independent Scale
      try {
        const initialCount = am.slots.length;
        const newSlot = await am.spawnClone('school');
        const cloneIdx = am.slots.length - 1;

        // Set clone to miniature chibi scale
        am.setScale(cloneIdx, 0.55);
        const masterScale = am.getScale(0);
        const cloneScale = am.getScale(cloneIdx);

        tests.push({
          name: '2. Clone Spawning & Independent Scale',
          pass: am.slots.length === initialCount + 1 && masterScale === 1.2 && cloneScale === 0.55,
          detail: \`Slots: \${am.slots.length}, Master Scale: \${masterScale}x, Clone Scale: \${cloneScale}x\`
        });
      } catch (err) {
        tests.push({ name: '2. Clone Spawning & Independent Scale', pass: false, detail: err.message });
      }

      // 3. Verify Gravity, Free Fall & Ground Impact Detection
      try {
        let impactDetected = false;
        physics.onAvatarImpact = (slot, speed) => {
          impactDetected = true;
        };

        // Drop active avatar from high above
        physics.dropAvatar(0, 2.5);
        const fallingState = am.slots[0].physicsState;
        const startY = am.slots[0].vrm.scene.position.y;

        // Simulate physics frames
        for (let i = 0; i < 60; i++) {
          physics.update(0.016);
        }

        const landedY = am.slots[0].vrm.scene.position.y;

        tests.push({
          name: '3. Gravity Drop & Ground Collision',
          pass: fallingState === 'falling' && startY >= 2.4 && landedY <= 0.1 && impactDetected,
          detail: \`Initial Y: \${startY.toFixed(2)}, Landed Y: \${landedY.toFixed(2)}, High-Impact Detected: \${impactDetected}\`
        });
      } catch (err) {
        tests.push({ name: '3. Gravity Drop & Ground Collision', pass: false, detail: err.message });
      }

      // 4. Verify Screen Patrol (Horizontal Roaming Across Monitor)
      try {
        // Toggle patrol mode
        const isPatrol = physics.togglePatrol(0);
        const stateDuringPatrol = am.slots[0].physicsState;
        const startX = am.slots[0].vrm.scene.position.x;

        // Simulate 45 frames of patrol movement
        for (let i = 0; i < 45; i++) {
          physics.update(0.016);
        }

        const advancedX = am.slots[0].vrm.scene.position.x;
        const deltaX = Math.abs(advancedX - startX);

        // Stop patrol
        physics.togglePatrol(0);
        const stoppedState = am.slots[0].physicsState;

        tests.push({
          name: '4. Screen Patrol Roaming Movement',
          pass: isPatrol === true && stateDuringPatrol === 'patrol' && deltaX > 0.1 && stoppedState === 'idle',
          detail: \`Patrol Active: \${isPatrol}, State: \${stateDuringPatrol} -> \${stoppedState}, Delta X: \${deltaX.toFixed(3)}m\`
        });
      } catch (err) {
        tests.push({ name: '4. Screen Patrol Roaming Movement', pass: false, detail: err.message });
      }

      // 5. Verify MultiAvatarBar UI Scale & Patrol Controls
      try {
        const btnScaleDown = document.getElementById('btnScaleDown');
        const btnScaleUp = document.getElementById('btnScaleUp');
        const labelScale = document.getElementById('labelCurrentScale');
        const btnPatrol = document.getElementById('btnTogglePatrol');
        const btnDrop = document.getElementById('btnDropFromHigh');

        const initialLabel = labelScale.textContent;
        btnScaleUp.click();
        const afterUpLabel = labelScale.textContent;
        btnScaleDown.click();
        const afterDownLabel = labelScale.textContent;

        tests.push({
          name: '5. MultiAvatarBar UI Buttons & Scale Display',
          pass: !!btnScaleDown && !!btnScaleUp && !!btnPatrol && !!btnDrop && afterUpLabel !== initialLabel,
          detail: \`Scale UI: \${initialLabel} -> \${afterUpLabel} -> \${afterDownLabel}, Patrol & Drop buttons verified\`
        });
      } catch (err) {
        tests.push({ name: '5. MultiAvatarBar UI Buttons & Scale Display', pass: false, detail: err.message });
      }

      // Clean up test clone
      if (am.slots.length > 1) {
        am.removeClone(1);
      }
      am.resetPositions();

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
    console.log('🎉 ALL 5 TEST SUITES PASSED PERFECTLY!\n');
    app.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED.\n');
    app.exit(1);
  }
});
