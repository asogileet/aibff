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

  console.log('[Test] Waiting for VRM and PuppetController to initialize...');

  // Wait for controllers to initialize
  await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.appControllers && window.appControllers.puppetController && window.appControllers.avatarManager?.getActiveVRM()) {
          clearInterval(check);
          resolve();
        }
      }, 150);
      setTimeout(() => { clearInterval(check); resolve(); }, 15000);
    })
  `);

  console.log('[Test] Running Dual Hand Index Finger Tracking Verification...');

  const results = await win.webContents.executeJavaScript(`
    (async () => {
      const controller = window.appControllers.puppetController;
      const vrm = window.appControllers.avatarManager.getActiveVRM();
      controller.setEnabled(true);

      const tests = [];

      // Test 1: Active joints projections
      const joints = controller.getJointScreenPositions();
      const hasKeyJoints = Boolean(joints.leftHand && joints.rightHand && joints.head);
      tests.push({
        name: 'Joint Projections Available',
        passed: hasKeyJoints,
        details: \`leftHand: \${Boolean(joints.leftHand)}, rightHand: \${Boolean(joints.rightHand)}\`
      });

      // Test 2: Dual Hand Proximity Snapping
      const leftTarget = joints.leftHand;
      const rightTarget = joints.rightHand;

      controller.updateFinger(0, 0, false, [
        { id: 'hand_0', x: leftTarget.x + 10, y: leftTarget.y + 10, isPinching: false, name: '食指 1' },
        { id: 'hand_1', x: rightTarget.x - 10, y: rightTarget.y + 10, isPinching: false, name: '食指 2' }
      ]);

      const pointers = controller.getActivePointers();
      const pointer0 = pointers.find(p => p.id === 'hand_0');
      const pointer1 = pointers.find(p => p.id === 'hand_1');

      const hoverCheck = pointer0?.hoveredJointKey === 'leftHand' && pointer1?.hoveredJointKey === 'rightHand';
      tests.push({
        name: 'Dual Index Hover Snapping',
        passed: hoverCheck,
        details: \`Hand 0 -> \${pointer0?.hoveredJointKey}, Hand 1 -> \${pointer1?.hoveredJointKey}\`
      });

      // Test 3: Dual Simultaneous Grabbing & Dragging
      // Record initial bone rotations
      const humanoid = vrm.humanoid;
      const lArm = humanoid.getNormalizedBoneNode('leftUpperArm');
      const rArm = humanoid.getNormalizedBoneNode('rightUpperArm');
      const initLZ = lArm.rotation.z;
      const initRZ = rArm.rotation.z;

      // Start pinch
      controller.updateFinger(0, 0, true, [
        { id: 'hand_0', x: leftTarget.x + 10, y: leftTarget.y + 10, isPinching: true, name: '食指 1' },
        { id: 'hand_1', x: rightTarget.x - 10, y: rightTarget.y + 10, isPinching: true, name: '食指 2' }
      ]);

      const grabCheck = pointer0?.grabbedJointKey === 'leftHand' && pointer1?.grabbedJointKey === 'rightHand';
      tests.push({
        name: 'Dual Index Simultaneous Grab',
        passed: grabCheck,
        details: \`Grabbed: Hand 0 = \${pointer0?.grabbedJointKey}, Hand 1 = \${pointer1?.grabbedJointKey}\`
      });

      // Move fingers outward & upward
      controller.updateFinger(0, 0, true, [
        { id: 'hand_0', x: leftTarget.x - 60, y: leftTarget.y - 80, isPinching: true, name: '食指 1' },
        { id: 'hand_1', x: rightTarget.x + 60, y: rightTarget.y - 80, isPinching: true, name: '食指 2' }
      ]);

      controller.update(0.016);

      const finalLZ = lArm.rotation.z;
      const finalRZ = rArm.rotation.z;

      // When dragging leftHand up/left, leftUpperArm rotation changes; same for rightUpperArm
      const lArmMoved = Math.abs(finalLZ - initLZ) > 0.05;
      const rArmMoved = Math.abs(finalRZ - initRZ) > 0.05;

      tests.push({
        name: 'Simultaneous Dual Arm Kinematic Pulling',
        passed: lArmMoved && rArmMoved,
        details: \`LeftArm deltaZ: \${(finalLZ - initLZ).toFixed(3)}, RightArm deltaZ: \${(finalRZ - initRZ).toFixed(3)}\`
      });

      // Test 4: Release and hold pose
      controller.updateFinger(0, 0, false, [
        { id: 'hand_0', x: leftTarget.x - 60, y: leftTarget.y - 80, isPinching: false, name: '食指 1' },
        { id: 'hand_1', x: rightTarget.x + 60, y: rightTarget.y - 80, isPinching: false, name: '食指 2' }
      ]);

      const releasedCheck = pointer0?.grabbedJointKey === null && pointer1?.grabbedJointKey === null;
      tests.push({
        name: 'Dual Index Clean Release',
        passed: releasedCheck,
        details: \`Pointers grabbedJointKey cleared\`
      });

      return tests;
    })();
  `);

  console.log('\n========================================');
  console.log('🧪 雙手食指追蹤與人偶牽引測試結果報告');
  console.log('========================================');
  let allPassed = true;
  for (const t of results) {
    const icon = t.passed ? '✅ PASS' : '❌ FAIL';
    if (!t.passed) allPassed = false;
    console.log(`${icon} | ${t.name}: ${t.details}`);
  }
  console.log('========================================');

  if (allPassed) {
    console.log('🎉 所有測試項目全數通過！');
  } else {
    console.error('⚠️ 部分測試未通過，請檢查詳細資訊。');
  }

  app.exit(allPassed ? 0 : 1);
});
