# 多螢幕全域透明畫布與跨屏漫遊規格文件 (Multi-Monitor Fullscreen Canvas Spec)

## 1. 問題概述 (Overview)
- **現狀背景**：在先前的實作中，全螢幕畫布切換（`window:toggle-fullscreen`）僅調用 Electron 的 `screen.getPrimaryDisplay()`，將透明畫布鎖定於主螢幕（如 1707x1067），無法覆蓋多螢幕環境（例如使用者的 3 台螢幕配置：左側 DISPLAY6: X=-1920、中央主螢幕 DISPLAY1: X=0、右側 DISPLAY5: X=2560）。
- **拖曳限制**：導入 3D 物理拾取與自由定位（`RaycastManager`）後，滑鼠拖曳人偶改為操作 Three.js 空間座標，導致人偶受限於單一主螢幕的畫布邊界，無法拖曳至其他螢幕。
- **漫遊限制**：桌寵自動漫遊（`MascotPhysicsController`）巡邏範圍依賴單一相機視野計算（`visibleW = visibleH * cam.aspect`），導致移動範圍（Range）顯得狹窄且無法跨越螢幕。

## 2. 解決方案架構 (Architecture)

### 2.1 虛擬桌面總邊界計算 (Virtual Desktop Multi-Monitor Bounding Box)
在 Electron 主進程（`src/main/main.js`）中，切換全螢幕畫布時調用 `screen.getAllDisplays()` 計算聯集虛擬總邊界：
```javascript
function getMultiMonitorBounds() {
  const displays = screen.getAllDisplays();
  const minX = Math.min(...displays.map(d => d.bounds.x));
  const minY = Math.min(...displays.map(d => d.bounds.y));
  const maxX = Math.max(...displays.map(d => d.bounds.x + d.bounds.width));
  const maxY = Math.max(...displays.map(d => d.bounds.y + d.bounds.height));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}
```
- 全域透明畫布將延伸覆蓋全部顯示器（例如跨幅達 6400px x 1147px）。
- 當使用者熱插拔螢幕或變更解析度時，監聽 `screen.on('display-metrics-changed')` 動態更新邊界。

### 2.2 相機視野與長寬比自動適應 (Dynamic Camera & Aspect Ratio)
- 在 Three.js `SceneManager.js` 中，監聽視窗 resize，動態更新相機投影矩陣與視錐大小：
  ```javascript
  this.camera.aspect = width / height; // 例如 6400 / 1147 = 5.58
  this.camera.updateProjectionMatrix();
  this.renderer.setSize(width, height);
  ```
- 當視窗寬度大幅增加時，水平可視範圍 `visibleW = visibleH * cam.aspect` 自動放大至原本的 3 倍以上，允許人偶與影分身在 3 台螢幕空間內自由遊走。

### 2.3 漫遊與巡邏邊界動態適配 (Cross-Screen Patrol Range)
- `MascotPhysicsController.js` 計算的漫遊邊界 `minX / maxX` 會無縫隨相機總長寬比延伸，自動讓小櫻穿梭於左、中、右三個螢幕之間。
- 支援透過設定或指令指定巡邏範圍（如：全螢幕跨屏巡邏 vs 鎖定指定螢幕巡邏）。

### 2.4 主螢幕 UI 錨定 (Primary Display UI Anchoring)
- 當畫布橫跨多個螢幕時，底部工具列（Toolbar）與頂部分身列（MultiAvatarBar）預設置中錨定於「主螢幕（Primary Display）」之可視區域中央，避免工具列落在兩螢幕交界縫隙處。

### 2.5 3D 拾取與拖曳跨螢幕支援 (Cross-Screen Raycast Dragging)
- `RaycastManager.js` 的滑鼠標準化座標計算（Normalized Device Coordinates）直接映射至多螢幕總寬度 `rect.width`，點擊並按住人偶即可在三個螢幕間任意平滑拖放、拋擲。
