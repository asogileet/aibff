const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const outputDir = path.join(__dirname, 'pose_snapshots');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 900,
    height: 900,
    show: true, // Visible window ensures Chromium compositor renders every frame actively
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

  console.log('[Test] Waiting for VRM model to load...');

  // Wait for avatarManager to load active VRM
  await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.appControllers && window.appControllers.avatarManager && window.appControllers.avatarManager.getActiveVRM()) {
          clearInterval(check);
          resolve();
        }
      }, 200);
      setTimeout(() => { clearInterval(check); resolve(); }, 15000);
    })
  `);

  // Allow extra 1.5s for initial scene stability
  await new Promise(r => setTimeout(r, 1500));

  console.log('[Test] Inspecting poses with full-body framing...');

  const actions = [
    { name: 'stand', dist: 4.0, panY: 0.70, theta: 0.15, phi: 0.08, time: 0 },
    { name: 'kneel', dist: 3.6, panY: 0.45, theta: 0.35, phi: 0.22, time: 1.2 },
    { name: 'frog_sit', dist: 3.6, panY: 0.45, theta: 0.25, phi: 0.20, time: 1.2 },
    { name: 'animal_crawl', dist: 3.4, panY: 0.45, theta: 0.45, phi: 0.25, time: 1.2 },
    { name: 'prone', dist: 3.3, panY: 0.35, theta: 0.45, phi: 0.40, time: 1.2 },
    { name: 'supine', dist: 3.3, panY: 0.35, theta: 0.45, phi: 0.40, time: 1.2 },
    { name: 'jumping_jacks', dist: 4.2, panY: 0.85, theta: 0.05, phi: 0.05, time: 0.26 },
    { name: 'dance', dist: 4.0, panY: 0.75, theta: 0.15, phi: 0.08, time: 0.60 }
  ];

  for (const cfg of actions) {
    console.log(`[Test] Triggering action: ${cfg.name}`);

    const info = await win.webContents.executeJavaScript(`
      (async () => {
        const anim = window.appControllers ? window.appControllers.animationController : null;
        const avMgr = window.appControllers ? window.appControllers.avatarManager : null;
        const sm = window.appControllers ? window.appControllers.sceneManager : null;
        const vrm = avMgr ? avMgr.getActiveVRM() : null;
        if (!anim || !vrm) return { error: 'No VRM or anim controller' };

        if ('${cfg.name}' === 'stand') {
          anim.resetToIdle();
          anim.actionTime = 0;
        } else {
          anim.playAction('${cfg.name}');
          anim.actionTime = ${cfg.time};
        }

        // Trigger updates manually
        anim.update(0.016);
        vrm.update(0.016);

        // Adjust camera to full body perspective
        if (sm) {
          sm.currentCameraDist = ${cfg.dist};
          sm.targetCameraDist = ${cfg.dist};
          sm.currentPanY = ${cfg.panY};
          sm.targetPanY = ${cfg.panY};
          sm.orbitTheta = ${cfg.theta};
          sm.targetOrbitTheta = ${cfg.theta};
          sm.orbitPhi = ${cfg.phi};
          sm.targetOrbitPhi = ${cfg.phi};
          sm._updateCameraTransform();
          sm.renderer.render(sm.scene, sm.camera);
        }

        // Wait 300ms for stable frame rendering
        await new Promise(r => setTimeout(r, 300));

        if ('${cfg.name}' === 'jumping_jacks') {
          // Peak jump is at sin(actionTime * 6.0) = 1.0 => actionTime = 0.2618
          anim.actionTime = 0.2618;
          anim.update(0.0001);
          vrm.update(0.0001);
        }

        if (sm) sm.renderer.render(sm.scene, sm.camera);

        const getPos = (name) => {
          const node = vrm.humanoid.getNormalizedBoneNode(name);
          if (!node) return null;
          node.updateWorldMatrix(true, false);
          const e = node.matrixWorld.elements;
          return { x: +e[12].toFixed(3), y: +e[13].toFixed(3), z: +e[14].toFixed(3) };
        };

        const getRot = (name) => {
          const node = vrm.humanoid.getNormalizedBoneNode(name);
          if (!node) return null;
          return { x: +node.rotation.x.toFixed(3), y: +node.rotation.y.toFixed(3), z: +node.rotation.z.toFixed(3) };
        };

        return {
          hips: getPos('hips'),
          leftKnee: getPos('leftLowerLeg'),
          rightKnee: getPos('rightLowerLeg'),
          leftFoot: getPos('leftFoot'),
          rightFoot: getPos('rightFoot'),
          leftHand: getPos('leftHand'),
          rightHand: getPos('rightHand'),
          hipsRot: getRot('hips'),
          leftUpperLegRot: getRot('leftUpperLeg'),
          rightUpperLegRot: getRot('rightUpperLeg')
        };
      })()
    `);

    console.log(`[Test] ${cfg.name} Positions:`, JSON.stringify(info));

    // Wait a brief tick before capture
    await new Promise(r => setTimeout(r, 100));

    const image = await win.capturePage();
    const filePath = path.join(outputDir, `${cfg.name}.png`);
    fs.writeFileSync(filePath, image.toPNG());
    console.log(`[Test] Saved screenshot to ${filePath}`);
  }

  console.log('[Test] Finished capturing all poses successfully.');
  win.close();
  app.quit();
});
