# 3D 鏡頭全身視角與動態重心控制實作計畫 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改進 3D 視窗鏡頭縮放控制，透過動態重心插值（Dynamic Target Y）與放寬縮放上限，讓滾輪能一路平滑拉遠至看得到角色全身（含雙腳與地面且不切頭），並新增工具列一鍵切換視角功能。

**Architecture:** 在 `SceneManager.js` 中引入以距離為變數的動態焦點高度計算公式，使得相機靠近時聚焦頭部面容 ($Y=1.25\text{m}$)，相機拉遠至全身時焦點平滑下移至角色人體中心 ($Y=0.75\text{m}$)；放寬 `maxDist` 至 $4.2\text{m}$；在 `Toolbar.js` 增加視角切換鈕並於 `app.js` 與快捷操作對接。

**Tech Stack:** Three.js r174 (PerspectiveCamera, MathUtils.lerp, MathUtils.clamp), Vanilla JS ES6+, Electron 34, Tailwind CSS.

## Global Constraints

* 繁體中文溝通與文件規範。
* 新增程式碼註解必須使用英文（English）。
* 既有註解直接維持原樣，嚴禁擅自翻譯。
* 未獲使用者授權同意前，嚴禁修改現有核心程式碼。
* 視窗維持透明無邊框，尺寸預設為 480 × 720。

---

### Task 1: 核心相機動態重心與縮放範圍升級 (`SceneManager.js`)

**Files:**
- Modify: `src/renderer/core/SceneManager.js`

**Interfaces:**
- Produces: 
  - `SceneManager.prototype.setCameraPreset(mode: 'bust' | 'full' | 'toggle'): void`
  - `SceneManager.prototype.targetCameraDist`: number (range $0.75 \sim 4.2$)
  - `SceneManager.prototype.cameraTarget`: THREE.Vector3 with dynamic $Y$

- [ ] **Step 1: 調整距離範圍參數與預設值**
  - 將 `this.maxDist = 3.2;` 更新為 `this.maxDist = 4.2;`。
  - 新增基礎目標高度常數：`this.bustTargetY = 1.25;`、`this.fullBodyTargetY = 0.75;`。

- [ ] **Step 2: 實作動態重心計算公式**
  - 在 `SceneManager._animate()` 或 `_updateCameraTransform()` 中：
  ```javascript
  // Calculate dynamic target Y based on current camera distance
  const t = THREE.MathUtils.clamp((this.currentCameraDist - 1.5) / (3.6 - 1.5), 0.0, 1.0);
  this.cameraTarget.y = THREE.MathUtils.lerp(this.bustTargetY, this.fullBodyTargetY, t);
  ```

- [ ] **Step 3: 提供視角預設切換方法 `setCameraPreset`**
  - 支援 `'bust'` (相機距離 1.8m) 與 `'full'` (相機距離 3.6m) 以及 `'toggle'`。
  - 平滑過渡至目標距離：`this.targetCameraDist = targetDist;`。

- [ ] **Step 4: 支援雙擊中鍵或雙擊畫面的視角快捷切換**
  - 在 `_bindCameraControls()` 中擴充：雙擊滑鼠左鍵（無拖曳且未擊中頭部時）或中鍵點擊時，切換全身/半身。

---

### Task 2: 底部工具列新增「視角切換」快捷按鈕 (`Toolbar.js` 與 `style.css`)

**Files:**
- Modify: `src/renderer/ui/Toolbar.js`
- Modify: `src/renderer/app.js`

**Interfaces:**
- Consumes: `onViewToggle: () => void` in `ToolbarOptions`
- Produces: `Toolbar.prototype.setViewMode(mode: 'bust' | 'full'): void`

- [ ] **Step 1: 在 `Toolbar.js` 增加相機視角切換圖示**
  - 新增圖示按鈕（全身小人圖示 `🧍` 或相機圖示），綁定 `onViewToggle` 回呼。
  - 根據當前模式切換按鈕的 Tooltip 說明（例如「切換至全身視角」/「切換至半身特寫」）。

- [ ] **Step 2: 在 `app.js` 中連接 `toolbar.onViewToggle` 與 `sceneManager.setCameraPreset('toggle')`**
  - 串接點擊事件，調用 `sceneManager.setCameraPreset('toggle')`。

---

### Task 3: 驗證與視角測試檢查

**Files:**
- Manual Verification in Electron container

- [ ] **Step 1: 滾輪縮放測試**
  - 滾輪往後滾動，確認相機距離能平滑延伸至 3.6m ~ 4.2m。
  - 確認下半身、裙擺、小腿與雙腳完整顯示在視窗內，且頭頂上方留有適當呼吸空間（不會裁切頭部或腳部）。
  
- [ ] **Step 2: 摸頭區域檢測**
  - 在全身視角（3.6m）與半身特寫（1.8m）下分別點擊角色頭部，確認 `RaycastManager` 碰撞檢測皆能正確觸發「摸摸頭」。

- [ ] **Step 3: 工具列按鈕切換測試**
  - 點擊工具列的視角按鈕，確認鏡頭平滑插值拉遠/拉近。
