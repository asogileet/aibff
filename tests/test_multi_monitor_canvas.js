const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('force-device-scale-factor', '1');

app.whenReady().then(async () => {
  // Setup IPC handler simulation matching main.js
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const minX = Math.min(...displays.map(d => d.bounds.x));
  const minY = Math.min(...displays.map(d => d.bounds.y));
  const maxX = Math.max(...displays.map(d => d.bounds.x + d.bounds.width));
  const maxY = Math.max(...displays.map(d => d.bounds.y + d.bounds.height));

  const multiBounds = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };

  const primaryRelative = {
    offsetX: primary.bounds.x - minX,
    offsetY: primary.bounds.y - minY,
    width: primary.bounds.width,
    height: primary.bounds.height
  };

  ipcMain.handle('window:get-display-layout', () => {
    return {
      bounds: multiBounds,
      primary: primaryRelative,
      displays: displays.map(d => d.bounds)
    };
  });

  let isFullscreen = false;
  ipcMain.handle('window:toggle-fullscreen', (event) => {
    isFullscreen = !isFullscreen;
    if (isFullscreen) {
      win.setBounds(multiBounds);
      win.webContents.send('window:display-metrics-changed', {
        bounds: multiBounds,
        primary: primaryRelative,
        displays: displays.map(d => d.bounds)
      });
    } else {
      win.setBounds({ width: 480, height: 720, x: 100, y: 100 });
      win.webContents.send('window:display-metrics-changed', null);
    }
    return isFullscreen;
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

  win.webContents.on('console-message', (event, level, message) => {
    if (!message.includes('attempts to index') && !message.includes('Missing min/max properties') && !message.includes('Electron Security Warning')) {
      console.log(`[Renderer] ${message}`);
    }
  });

  await win.loadFile(path.join(__dirname, '../src/renderer/index.html'));

  console.log('[Test] Waiting for scene and UI controllers to initialize...');
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

  console.log('[Test] Running Multi-Monitor Canvas & Roaming Verifications...');

  const results = await win.webContents.executeJavaScript(`
    (async () => {
      const tests = [];
      const sm = window.appControllers.sceneManager;
      const physics = window.appControllers.mascotPhysicsController;
      const am = window.appControllers.avatarManager;

      // 1. Verify getDisplayLayout IPC
      let layout = null;
      if (window.electronAPI && typeof window.electronAPI.getDisplayLayout === 'function') {
        layout = await window.electronAPI.getDisplayLayout();
      }
      const hasLayout = layout && layout.bounds && layout.primary && Array.isArray(layout.displays);
      tests.push({
        name: '1. getDisplayLayout returns multi-monitor bounding box & primary offset',
        pass: !!hasLayout,
        detail: hasLayout ? \`Total Width: \${layout.bounds.width}px, Displays: \${layout.displays.length}, Primary OffsetX: \${layout.primary.offsetX}px\` : 'Failed to retrieve layout'
      });

      // 2. Toggle Multi-Monitor Fullscreen Canvas
      const isFull = await window.electronAPI.toggleFullscreen();
      await new Promise(r => setTimeout(r, 600));

      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;
      const isMultiWidth = winWidth >= 6000;
      tests.push({
        name: '2. Fullscreen canvas expands across multi-monitor virtual desktop width',
        pass: isFull && isMultiWidth,
        detail: \`Window Dimensions: \${winWidth} x \${winHeight}px (Expected >= 3000px on multi-monitor)\`
      });

      // 3. Three.js Camera Aspect Ratio & Frustum expansion
      const camAspect = sm.camera.aspect;
      const vFov = (sm.camera.fov * Math.PI) / 180;
      const dist = 2.5;
      const visibleW = 2 * Math.tan(vFov / 2) * dist * camAspect;
      const aspectExpanded = camAspect > 3.0 && visibleW > 4.0;
      tests.push({
        name: '3. Camera aspect ratio and visible horizontal width expand proportionally',
        pass: aspectExpanded,
        detail: \`Camera Aspect: \${camAspect.toFixed(2)}, Visible 3D Width: \${visibleW.toFixed(2)}m (Expanded from ~2.3m)\`
      });

      // 4. MascotPhysicsController Patrol Roaming Boundaries
      const slot = am.getActiveSlot();
      const halfW = visibleW / 2;
      const safeMargin = Math.min(halfW * 0.35, 0.45 * (slot?.scale || 1.0));
      const minX = sm.camera.position.x - halfW + safeMargin;
      const maxX = sm.camera.position.x + halfW - safeMargin;
      const roamRange = maxX - minX;
      const wideRange = roamRange > 3.5;
      tests.push({
        name: '4. Patrol roaming horizontal range covers multi-screen boundaries',
        pass: wideRange,
        detail: \`Roam Range: \${roamRange.toFixed(2)}m (minX: \${minX.toFixed(2)}m, maxX: \${maxX.toFixed(2)}m)\`
      });

      // 5. Primary Display UI Anchoring
      const bottomToolbar = document.getElementById('bottomToolbar');
      const topBar = document.getElementById('multiAvatarBar');
      const primaryCenter = layout ? layout.primary.offsetX + layout.primary.width / 2 : 0;
      const toolbarLeft = bottomToolbar ? parseFloat(bottomToolbar.style.left) : 0;
      const topBarLeft = topBar ? parseFloat(topBar.style.left) : 0;
      const uiAnchored = Math.abs(toolbarLeft - primaryCenter) < 5 && Math.abs(topBarLeft - primaryCenter) < 5;
      tests.push({
        name: '5. Bottom toolbar & top avatar bar anchored to primary screen center',
        pass: uiAnchored,
        detail: \`Primary Center: \${primaryCenter.toFixed(0)}px, Toolbar Left: \${toolbarLeft}px, TopBar Left: \${topBarLeft}px\`
      });

      // 6. Toggle back to small window mode
      const isSmall = !(await window.electronAPI.toggleFullscreen());
      await new Promise(r => setTimeout(r, 400));
      const smallReset = !bottomToolbar.style.left && !topBar.style.left;
      tests.push({
        name: '6. Toggling back to small window restores default UI centering',
        pass: isSmall && smallReset,
        detail: \`Small window state restored: \${isSmall}, UI style.left cleared: \${smallReset}\`
      });

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
    console.log('🎉 MULTI-MONITOR CANVAS VERIFIED SUCCESSFULLY!\n');
    app.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED.\n');
    app.exit(1);
  }
});
