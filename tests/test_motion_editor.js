const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 900,
    height: 900,
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

  console.log('[Test] Waiting for VRM and UI controllers to initialize...');

  await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.appControllers && window.appControllers.motionManager && window.appControllers.avatarManager?.getActiveVRM()) {
          clearInterval(check);
          resolve();
        }
      }, 150);
      setTimeout(() => { clearInterval(check); resolve(); }, 15000);
    })
  `);

  console.log('[Test] Running Motion Editor Verifications...');

  const results = await win.webContents.executeJavaScript(`
    (async () => {
      const tests = [];
      const { motionManager: mm, poseManager: pm, animationController: anim, avatarManager } = window.appControllers;
      const vrm = avatarManager.getActiveVRM();
      const arm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
      const armDeg = () => arm.rotation.z * 180 / Math.PI;
      const TEST_NAME = '測試動作_motion_editor';
      const DOWN = -68; // resting arm
      const UP = -150;

      // 1. The pose bar button opens the editor, and poses can be collected as keyframes
      try {
        const panel = document.getElementById('motionEditor');
        document.getElementById('btnOpenMotionEditor').click();
        const opened = !panel.classList.contains('hidden');

        mm.clearKeyframes();
        pm.resetToDefault();
        document.getElementById('btnAddKeyframe').click();
        pm.setJointRotation('rightUpperArm', { x: 0, y: 0, z: UP });
        document.getElementById('btnAddKeyframe').click();

        const rows = document.querySelectorAll('#motionKeyframeList .btnShowKeyframe').length;
        const z0 = mm.keyframes[0]?.joints.rightUpperArm.z;
        const z1 = mm.keyframes[1]?.joints.rightUpperArm.z;
        tests.push({
          name: 'Editor opens & collects poses as keyframes',
          passed: opened && rows === 2 && z0 === DOWN && z1 === UP,
          details: \`opened: \${opened}, rows: \${rows}, arm z: \${z0} -> \${z1}\`
        });
      } catch (err) {
        tests.push({ name: 'Editor opens & collects keyframes', passed: false, details: err.message });
      }

      // The render loop is throttled in a hidden window, so playback is stepped by hand here

      // 2. Playback blends from pose to pose and holds the last one
      try {
        mm.setKeyframeDuration(1, 0.6);
        document.getElementById('btnPlayMotion').click();
        const started = mm.isPlaying;
        mm.update(0.35); // blend-in reaches pose 1
        const atFirst = armDeg();
        mm.update(0.3); // halfway to pose 2
        const midway = armDeg();
        const midIndex = mm.currentIndex;
        for (let i = 0; i < 4 && mm.isPlaying; i++) mm.update(0.1);
        const finalZ = armDeg();
        const isBetween = midway < DOWN - 10 && midway > UP + 10;
        const held = anim.isCustomPoseOverride && pm.getJointRotation('rightUpperArm').z === UP;
        tests.push({
          name: 'Playback interpolates between poses and holds the last',
          passed: started && Math.abs(atFirst - DOWN) < 8 && midIndex === 1 && isBetween && !mm.isPlaying && Math.abs(finalZ - UP) < 1 && held,
          details: \`started: \${started}, arm z: \${atFirst.toFixed(1)} -> \${midway.toFixed(1)} -> \${finalZ.toFixed(1)}, finished: \${!mm.isPlaying}, held: \${held}\`
        });
      } catch (err) {
        tests.push({ name: 'Playback interpolates', passed: false, details: err.message });
      }

      // 3. Looping keeps going until stopped; a built-in action interrupts playback
      try {
        mm.play({ loop: true });
        for (let i = 0; i < 40; i++) mm.update(0.1);
        const stillLooping = mm.isPlaying;
        mm.stop();
        const stopped = !mm.isPlaying;

        mm.play({ loop: true });
        mm.update(0.1);
        anim.playAction('waving');
        mm.update(0.016);
        const interrupted = !mm.isPlaying && anim.currentAction === 'waving';
        anim.resetToIdle();

        tests.push({
          name: 'Loop playback, stop, and interruption by an action',
          passed: stillLooping && stopped && interrupted,
          details: \`stillLooping: \${stillLooping}, stopped: \${stopped}, interrupted: \${interrupted}\`
        });
      } catch (err) {
        tests.push({ name: 'Loop playback', passed: false, details: err.message });
      }

      // 4. Saving, reloading and deleting a named motion
      try {
        document.getElementById('inputMotionName').value = TEST_NAME;
        document.getElementById('btnSaveMotion').click();
        const stored = JSON.parse(localStorage.getItem('aibff_custom_motions') || '[]').find((m) => m.name === TEST_NAME);
        const listed = Array.from(document.querySelectorAll('#savedMotionList .motionName')).some((el) => el.textContent.includes(TEST_NAME));

        mm.clearKeyframes();
        const found = mm.findMotionByName(TEST_NAME);
        mm.loadMotion(found.id);
        const reloaded = mm.keyframes.length === 2 && mm.keyframes[1].joints.rightUpperArm.z === UP;

        mm.deleteMotion(found.id);
        const deleted = !JSON.parse(localStorage.getItem('aibff_custom_motions') || '[]').some((m) => m.name === TEST_NAME);

        tests.push({
          name: 'Save / reload / delete motion',
          passed: Boolean(stored) && stored.keyframes.length === 2 && listed && reloaded && deleted,
          details: \`stored: \${Boolean(stored)}, listed: \${listed}, reloaded: \${reloaded}, deleted: \${deleted}\`
        });
      } catch (err) {
        tests.push({ name: 'Save / reload / delete motion', passed: false, details: err.message });
      }

      mm.clearKeyframes();
      pm.resetToDefault();
      return tests;
    })();
  `);

  console.log('\n================ TEST RESULTS ================');
  let allPassed = true;
  results.forEach(t => {
    const mark = t.passed ? '✅ PASS' : '❌ FAIL';
    if (!t.passed) allPassed = false;
    console.log(`${mark} [${t.name}] -> ${t.details}`);
  });
  console.log('==============================================\n');

  win.close();
  app.quit();
  process.exit(allPassed ? 0 : 1);
});
