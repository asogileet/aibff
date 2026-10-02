# 3D 消失點與立體透視控制實作計畫 (Implementation Plan)

## 1. 概述與目標
在 Three.js 桌面 AI 女友應用中，為相機增加動態消失點（光軸位移 View Offset）、視野廣角調節（FOV）、可開關空間地面透視網格（Spatial Grid Helper）以及透視輔助射線，讓使用者能自由設定消失點與景深張力，營造極具衝擊感的 3D 立體效果。

---

## 2. 修改範圍分析 (Scope Analysis)

### 2.1 `src/renderer/core/SceneManager.js`
- **相機參數擴充**：
  - 新增 `fov`（預設 30°）、`vpOffsetX`（歸一化 -1.0 ~ 1.0）、`vpOffsetY`（歸一化 -1.0 ~ 1.0）。
  - `_initCamera()` 與 `_onResize()` 中加入 `camera.setViewOffset()` 計算與更新。
  - 新增 API：
    - `setFov(fov)`: 設定相機視野角並更新投影矩陣。
    - `setVanishingPoint(offsetX, offsetY)`: 設定消失點偏移並更新 `camera.setViewOffset()`。
    - `setPerspectivePreset(presetName)`: 套用自然平視、動漫廣角、公仔望遠、張力極致仰視等預設。
- **空間透視參考網格**：
  - 新增 `gridHelper` (`THREE.GridHelper`) 放置於角色腳底地面 ($y = 0$)。
  - 新增 API `setGridVisible(visible)` 與 `setGridStyle(style)`（浪漫粉光、賽博冷青、極簡白）。
- **透視射線 / 消失點指示器**：
  - 新增可開關的透視輔助線群組（`perspectiveGuideLines`），以虛線射線指向當前消失點。

### 2.2 `src/renderer/ui/SettingsModal.js`
- **介面新增「📐 3D 鏡頭與空間透視（消失點與立體感）」區塊**：
  - **視野廣角滑桿 (FOV)**：15° ~ 85°，即時反饋數值。
  - **消失點 X / Y 軸偏移滑桿**：-1.0 ~ +1.0，即時微調。
  - **風格預設集按鈕**：
    - 「自然平視」(FOV 35°, VP 0, 0)
    - 「動漫廣角」(FOV 65°, VP 0, -0.45)
    - 「公仔望遠」(FOV 20°, VP 0, 0)
    - 「張力仰視」(FOV 75°, VP 0.25, -0.65)
  - **空間地面網格開關** (Checkbox) 與色彩風格選擇器。
  - **透視輔助線開關** (Checkbox)。
  - **重設按鈕**：一鍵恢復預設透視。
- **配置持久化**：
  - 於讀取與儲存設定時，整合 `config.cameraPerspective` 物件。

### 2.3 `src/renderer/app.js`
- 將 `SceneManager` 與 `SettingsModal` 之透視參數進行雙向串接。
- 啟動時自 `config.json` 載入透視與消失點參數並套用至場景相機。

---

## 3. 實作步驟分工 (Implementation Steps)

### 步驟一：SceneManager 核心透視與消失點能力擴充
1. 在 `SceneManager` 建構子初始化透視參數與預設值。
2. 實作 `_applyPerspective()` 方法，封裝 `camera.fov` 與 `camera.setViewOffset()` 計算。
3. 建立並管理地面 `THREE.GridHelper` 與可選的透視導引線物件。
4. 提供外部呼叫的 Getter / Setter 與預設集方法。

### 步驟二：SettingsModal 介面與事件綁定
1. 在 `SettingsModal._render()` HTML template 中插入透視調節區塊。
2. 綁定各滑桿的 `input` 事件，以達成「拖曳滑桿時即時預覽 3D 透視」之流暢體驗。
3. 綁定風格預設集點擊事件與重設按鈕。
4. 儲存時將透視參數打包進整體設定。

### 步驟三：整合串接與設定保存
1. 在 `app.js` 中將儲存事件通知 `SceneManager` 即時生效。
2. 測試並驗證視窗 Resize、相機距離縮放 (Mouse Wheel Zoom) 與消失點位移之相容性。

---

## 4. 驗證與授權原則
- **嚴格遵守規範**：本計畫目前僅為提案與規格產出階段。
- **未經明確許可絕不更動正式程式碼**。
- **待使用者審閱並回覆同意後**，方才啟動正式程式碼變更。
- **程式碼修改完成後，嚴禁自動執行測試**，需主動詢問取得授權。
