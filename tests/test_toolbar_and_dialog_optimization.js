const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 900,
    height: 900,
    show: false, // Headless test
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

  console.log('[Test] Waiting for UI controllers to initialize...');

  await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.appControllers && window.appControllers.multiAvatarBar && window.appControllers.chatBox && window.appControllers.toolbar) {
          clearInterval(check);
          resolve();
        }
      }, 150);
      setTimeout(() => { clearInterval(check); resolve(); }, 15000);
    })
  `);

  console.log('[Test] Running Toolbar & Dialog Optimization Verifications...');

  const results = await win.webContents.executeJavaScript(`
    (async () => {
      const tests = [];
      const { multiAvatarBar, toolbar, chatBox, updateBubbleOffset, showBubble } = window.appControllers;

      // 1. Verify Scrollbar Removal Classes
      try {
        const slotsContainer = document.getElementById('cloneSlotsContainer');
        const bottomToolbar = document.getElementById('bottomToolbar');
        const topBar = document.getElementById('multiAvatarBar');

        const topHasNoScrollbar = topBar?.classList.contains('no-scrollbar');
        const slotsHasNoScrollbar = slotsContainer?.classList.contains('no-scrollbar');
        const bottomHasNoScrollbar = bottomToolbar?.classList.contains('no-scrollbar');

        const pass = topHasNoScrollbar && slotsHasNoScrollbar && bottomHasNoScrollbar;
        tests.push({
          name: 'Scrollbar removal classes applied on top & bottom toolbars',
          pass,
          detail: pass ? 'All toolbars and containers have .no-scrollbar class' : 'Missing .no-scrollbar on elements'
        });
      } catch (err) {
        tests.push({ name: 'Scrollbar removal classes', pass: false, detail: err.message });
      }

      // 2. Verify Top Bar Collapse and Mini Restore Capsule
      try {
        const topBar = document.getElementById('multiAvatarBar');
        const btnHide = document.getElementById('btnHideCloneBar');
        const miniBar = document.getElementById('miniAvatarRestoreBar');
        const tbClone = document.getElementById('btnClone');

        const initialVisible = !topBar.classList.contains('hidden') && miniBar.classList.contains('hidden');

        // Click hide button on top bar
        btnHide.click();
        const collapsedSuccess = topBar.classList.contains('hidden') && !miniBar.classList.contains('hidden');
        const cloneBtnUnselected = !tbClone.classList.contains('ring-2');

        // Click mini restore button
        miniBar.click();
        const restoredSuccess = !topBar.classList.contains('hidden') && miniBar.classList.contains('hidden');

        const pass = initialVisible && collapsedSuccess && cloneBtnUnselected && restoredSuccess;
        tests.push({
          name: 'Top MultiAvatarBar collapse button & mini restore capsule',
          pass,
          detail: pass ? 'Top bar collapsible via [✕], restore capsule works, Toolbar state synchronized' : 'State mismatch on collapse/restore'
        });
      } catch (err) {
        tests.push({ name: 'Top MultiAvatarBar collapse and restore', pass: false, detail: err.message });
      }

      // 3. Verify Dialogue Bubble Smart Offset & Interactive Controls
      try {
        const bubble = document.getElementById('dialogueBubble');
        const miniBubble = document.getElementById('btnRestoreBubble');
        const btnCollapse = document.getElementById('btnCollapseBubble');
        const btnExpand = document.getElementById('btnExpandBubble');
        const btnClose = document.getElementById('btnCloseBubble');
        const msgEl = document.getElementById('dialogueMessage');

        // Show bubble with long message
        showBubble('這是一條長訊息用來測試對話框展開與避讓功能。', 'happy');

        // Top bar is visible, bubble should have bubble-offset-single
        const hasSingleOffset = bubble.classList.contains('bubble-offset-single');

        // Hide top bar, bubble should update to bubble-offset-top
        multiAvatarBar.setVisible(false);
        updateBubbleOffset();
        const hasTopOffset = bubble.classList.contains('bubble-offset-top');

        // Restore top bar
        multiAvatarBar.setVisible(true);
        updateBubbleOffset();

        // Test Expand
        btnExpand.click();
        const isExpanded = !msgEl.classList.contains('line-clamp-3') && bubble.classList.contains('max-w-md');

        // Test Collapse
        btnCollapse.click();
        const isCollapsed = bubble.classList.contains('hidden') && !miniBubble.classList.contains('hidden');

        // Test Restore from mini pill
        miniBubble.click();
        const isRestored = !bubble.classList.contains('hidden') && miniBubble.classList.contains('hidden');

        // Test Close
        btnClose.click();
        const isClosed = bubble.classList.contains('hidden') && miniBubble.classList.contains('hidden');

        const pass = hasSingleOffset && hasTopOffset && isExpanded && isCollapsed && isRestored && isClosed;
        tests.push({
          name: 'Dialogue Bubble smart offset avoiding toolbars & collapse/expand controls',
          pass,
          detail: pass ? 'Smart dynamic offset, collapse to mini pill, full expand, and close fully functional' : 'Dialogue bubble behavior failure'
        });
      } catch (err) {
        tests.push({ name: 'Dialogue Bubble smart offset and controls', pass: false, detail: err.message });
      }

      // 4. Verify ChatBox Tri-state Controls & Docking
      try {
        const chatEl = document.getElementById('chatModal');
        const miniChat = document.getElementById('minimizedChatBar');
        const btnDock = document.getElementById('btnDockChat');
        const btnMin = document.getElementById('btnMinimizeChat');
        const btnMax = document.getElementById('btnMaximizeChat');
        const btnClose = document.getElementById('btnCloseChat');
        const chatHistory = document.getElementById('chatHistory');

        // Open chat modal
        chatBox.toggle(true);
        const isOpen = !chatEl.classList.contains('hidden');

        // Test Dock Right (avoids blocking center avatar)
        btnDock.click();
        const isDockedRight = chatEl.classList.contains('right-6') && !chatEl.classList.contains('left-1/2');

        // Test Full Maximize
        btnMax.click();
        const isMaximized = chatEl.classList.contains('max-w-2xl') && chatHistory.classList.contains('h-96');

        // Test Restore from Maximize
        btnMax.click();
        const isRestoredFromMax = chatEl.classList.contains('max-w-sm') && chatHistory.classList.contains('h-44');

        // Test Minimize to floating capsule
        btnMin.click();
        const isMinimized = chatEl.classList.contains('hidden') && !miniChat.classList.contains('hidden');

        // Test Restore from floating capsule
        miniChat.click();
        const isRestoredFromMin = !chatEl.classList.contains('hidden') && miniChat.classList.contains('hidden');

        // Test Close
        btnClose.click();
        const isClosed = chatEl.classList.contains('hidden') && miniChat.classList.contains('hidden');

        const pass = isOpen && isDockedRight && isMaximized && isRestoredFromMax && isMinimized && isRestoredFromMin && isClosed;
        tests.push({
          name: 'ChatBox dock-right avoidance, collapse to capsule, and full maximize/restore',
          pass,
          detail: pass ? 'Dock right avoidance, minimize capsule, and full expansion all verified' : 'ChatBox state verification failed'
        });
      } catch (err) {
        tests.push({ name: 'ChatBox controls and docking', pass: false, detail: err.message });
      }

      return tests;
    })();
  `);

  console.log('\n=========================================');
  console.log('       OPTIMIZATION TEST RESULTS         ');
  console.log('=========================================');

  let allPass = true;
  results.forEach((t, i) => {
    const symbol = t.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${i + 1}. [${symbol}] ${t.name}`);
    console.log(`   Detail: ${t.detail}`);
    if (!t.pass) allPass = false;
  });

  console.log('=========================================');
  if (allPass) {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('💥 SOME TESTS FAILED!');
  }

  win.close();
  app.quit();
  process.exit(allPass ? 0 : 1);
});
