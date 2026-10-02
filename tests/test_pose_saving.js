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

  // Wait for controllers to initialize
  await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.appControllers && window.appControllers.poseManager && window.appControllers.puppetController && window.appControllers.avatarManager?.getActiveVRM()) {
          clearInterval(check);
          resolve();
        }
      }, 150);
      setTimeout(() => { clearInterval(check); resolve(); }, 15000);
    })
  `);

  console.log('[Test] Running Pose Saving Verifications...');

  const results = await win.webContents.executeJavaScript(`
    (async () => {
      const tests = [];
      const pm = window.appControllers.poseManager;
      const puppet = window.appControllers.puppetController;
      const anim = window.appControllers.animationController;

      // 1. Verify PuppetPoseBar inline popover and saving
      try {
        const barEl = document.getElementById('puppetPoseBar');
        const btnSave = document.getElementById('btnSavePuppetPose');
        const popover = document.getElementById('savePosePopover');
        const inputName = document.getElementById('inputPuppetPoseName');
        const btnConfirm = document.getElementById('btnConfirmPuppetSave');

        // Click save button to trigger popover
        btnSave.click();
        const popoverOpened = !popover.classList.contains('hidden');

        // Type test pose name
        inputName.value = '測試玩偶姿勢_99';
        btnConfirm.click();

        const popoverClosed = popover.classList.contains('hidden');
        const savedPoses = pm.getSavedPoses();
        const foundPuppetPose = savedPoses.some(p => p.name === '測試玩偶姿勢_99');

        tests.push({
          name: 'PuppetPoseBar Save Popover & Persistence',
          passed: popoverOpened && popoverClosed && foundPuppetPose,
          details: \`opened: \${popoverOpened}, closed: \${popoverClosed}, saved: \${foundPuppetPose}\`
        });
      } catch (err) {
        tests.push({ name: 'PuppetPoseBar Save Popover', passed: false, details: err.message });
      }

      // 2. Verify PoseModal auto-capture when opening during an action
      try {
        const modal = window.appControllers.poseModal;
        const vrm = window.appControllers.avatarManager?.getActiveVRM();

        // Trigger a distinct posture: kneel
        anim.playAction('kneel');
        anim.actionTime = 1.0;
        anim.update(0.016);
        if (vrm) vrm.update(0.016);

        // Open PoseModal (triggers auto-capture on opening)
        modal.toggle(true);

        const modalEl = document.getElementById('poseModal');
        const btnModalSave = document.getElementById('btnSaveNewPose');
        const inputModalName = document.getElementById('inputNewPoseName');

        // Modal elements exist
        const modalHasInput = Boolean(modalEl && btnModalSave && inputModalName);

        // Capture check: kneeling bends thighs and knees (rotX is negative)
        const leftLowerLeg = pm.getJointRotation('leftLowerLeg');
        const isBent = leftLowerLeg.x !== 0;

        // Save via PoseModal
        inputModalName.value = '測試跪坐姿勢_88';
        btnModalSave.click();

        const savedPoses = pm.getSavedPoses();
        const foundModalPose = savedPoses.some(p => p.name === '測試跪坐姿勢_88');

        // Also test Enter key handler on PoseModal input
        inputModalName.value = '測試Enter鍵姿勢_77';
        inputModalName.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        const foundEnterPose = pm.getSavedPoses().some(p => p.name === '測試Enter鍵姿勢_77');

        tests.push({
          name: 'PoseModal Auto-capture & Enter key Save',
          passed: modalHasInput && isBent && foundModalPose && foundEnterPose,
          details: \`knee bent rotX: \${leftLowerLeg.x}°, foundModalPose: \${foundModalPose}, foundEnterPose: \${foundEnterPose}\`
        });
      } catch (err) {
        tests.push({ name: 'PoseModal Auto-capture', passed: false, details: err.message });
      }

      // 3. Verify LocalStorage persistence
      try {
        const raw = localStorage.getItem('aibff_custom_poses');
        const parsed = JSON.parse(raw || '[]');
        const hasPuppet = parsed.some(p => p.name === '測試玩偶姿勢_99');
        const hasKneel = parsed.some(p => p.name === '測試跪坐姿勢_88');
        const hasEnter = parsed.some(p => p.name === '測試Enter鍵姿勢_77');

        tests.push({
          name: 'LocalStorage JSON Persistence',
          passed: hasPuppet && hasKneel && hasEnter,
          details: \`stored \${parsed.length} poses, hasPuppet: \${hasPuppet}, hasKneel: \${hasKneel}, hasEnter: \${hasEnter}\`
        });
      } catch (err) {
        tests.push({ name: 'LocalStorage Persistence', passed: false, details: err.message });
      }

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
