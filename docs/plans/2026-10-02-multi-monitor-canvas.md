# 三螢幕全域透明巨幅畫布與跨屏漫遊實作計畫 (Implementation Plan)

## 1. 任務背景與目標
- **問題現狀**：使用者擁有 3 台顯示器（DISPLAY6: X=-1920、DISPLAY1: X=0、DISPLAY5: X=2560），目前全螢幕畫布僅抓取主螢幕（`screen.getPrimaryDisplay()`），導致透明畫布被限制在主螢幕（1707x1067），無法跨越至其他螢幕。此外，因 3D 物理拾取改為場景座標位移，以及相機視錐僅限單螢幕寬度，造成人偶移動範圍（Range）縮小且無法拖曳至其他螢幕。
- **目標**：
  1. 在 Electron 主進程將全螢幕透明畫布升級為全顯示器聯集邊界（覆蓋全部 3 台螢幕，寬達 6,400px）。
  2. 動態適配相機長寬比與投影矩陣，使 Three.js 視角覆蓋三螢幕。
  3. 擴展 `MascotPhysicsController` 的漫遊與巡邏邊界（`minX / maxX`），使桌寵能在 3 台螢幕之間自在漫遊、奔跑與折返。
  4. 讓 `RaycastManager` 3D 拖曳支援全域滑鼠坐標映射，可隨手將人偶抓起放置於任一螢幕。
  5. 保持主工具列與頂部分身列預設置中錨定在主螢幕視區中央。

---

## 2. 影響範圍與模組架構

```
[ Electron Main Process ]
       │
       ▼ (window:toggle-fullscreen / screen.getAllDisplays())
  src/main/main.js
       │
       ▼ (setBounds: x=-1920, y=0, width=6400, height=1147)
[ Renderer Process ]
  ├── src/renderer/core/SceneManager.js (resize camera aspect & renderer buffer)
  ├── src/renderer/vrm/MascotPhysicsController.js (extend minX / maxX roaming bounds)
  ├── src/renderer/core/RaycastManager.js (full-width raycast drag mapping)
  └── src/renderer/ui/Toolbar.js & MultiAvatarBar.js (anchor to primary display center)
```

---

## 3. 詳細實作步驟

### 步驟 1：Electron 主進程動態計算多螢幕總邊界 (`src/main/main.js`)
- 定義 `getVirtualDesktopBounds()`：
  ```javascript
  function getVirtualDesktopBounds() {
    const displays = screen.getAllDisplays();
    const minX = Math.min(...displays.map(d => d.bounds.x));
    const minY = Math.min(...displays.map(d => d.bounds.y));
    const maxX = Math.max(...displays.map(d => d.bounds.x + d.bounds.width));
    const maxY = Math.max(...displays.map(d => d.bounds.y + d.bounds.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  ```
- 在 `ipcMain.handle('window:toggle-fullscreen')` 中：
  - 當切換至全螢幕模式時，使用 `getVirtualDesktopBounds()` 進行 `mainWindow.setBounds(...)`。
  - 當切換回小視窗時，精確恢復先前的視窗位置與大小。
- 監聽 `screen.on('display-metrics-changed')` 與 `screen.on('display-added')` / `screen.on('display-removed')`，當螢幕配置變更且處於全螢幕模式時自動更新視窗大小與位置。

### 步驟 2：Three.js 相機視野與長寬比動態調整 (`src/renderer/core/SceneManager.js`)
- 在 `onWindowResize` / `resize()` 中：
  - 更新相機長寬比 `this.camera.aspect = width / height`。
  - 更新投影矩陣 `this.camera.updateProjectionMatrix()`。
  - 調整 WebGLRenderer 的渲染尺寸，若寬度大於 3000px，適度限制 `pixelRatio = Math.min(window.devicePixelRatio, 1.0)` 以確保 60FPS 流暢度與 GPU 負載平衡。

### 步驟 3：擴展人偶漫遊與巡邏水平邊界 (`src/renderer/vrm/MascotPhysicsController.js`)
- 在 `_updatePatrolMovement` 中：
  - 動態計算 `visibleW = visibleH * cam.aspect`（三螢幕總寬度下 `cam.aspect` 約為 5.58，`visibleW` 擴展至約 7.5 公尺）。
  - 將水平巡邏邊界 `minX / maxX` 根據相機寬度無縫擴大，讓人偶在 3 個螢幕的邊緣自動折返與左右奔跑。

### 步驟 4：支援 3D 射線全螢幕跨屏拖曳 (`src/renderer/core/RaycastManager.js`)
- 確保在巨幅畫布下，滑鼠歸一化座標 `this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1` 精確對齊 3D 空間，使用者拖曳人偶可以一路從螢幕 3（左）滑行到螢幕 2（右），鬆開後平穩墜落於該螢幕的地板。

### 步驟 5：UI 工具列在多螢幕下的置中保護 (`src/renderer/ui/Toolbar.js` / CSS)
- 在多螢幕巨幅畫布模式下，若純粹使用 `left: 50%`，會剛好落在主螢幕正中央（`(-1920 + 4480)/2 = 1280`，位於 DISPLAY1 內）。
- 補充主螢幕坐標校正邏輯，確保即使在不對稱的多螢幕排列下，工具列與分身列仍完美懸浮於使用者正面之主螢幕下方與上方。

---

## 4. 驗證與授權計畫 (Verification Plan)
- **手動視覺驗證**：
  1. 按下 `F11` 或輸入 `/fs` / `/fullscreen`，觀察透明畫布是否瞬間跨越覆蓋全部 3 台螢幕。
  2. 點擊並按住人偶，拖曳至左側螢幕（DISPLAY6）與右側螢幕（DISPLAY5），確認人偶能自由穿梭各螢幕。
  3. 點擊「分身列」中的「🏃 漫遊」按鈕（或輸入 `/patrol`），確認人偶能在 3 台螢幕的總寬度範圍內來回奔跑與轉向折返。
  4. 觀察底部工具列與對話框是否依然穩定置中於主螢幕。
- **測試授權說明**：
  - 依照核心開發規範，在程式碼完成修改後，**嚴禁自動啟動自動化測試**。我將會先行主動向您回報，取得明確授權後方可執行相關驗證指令。
