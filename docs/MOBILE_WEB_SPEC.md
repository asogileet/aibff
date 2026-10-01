# 手機版網頁 (Mobile Web) - 方案 A (區域網路連線) 規格書

## 1. 需求與目標
讓使用者在同一個 Wi-Fi 區域網路內，直接使用智慧型手機（iOS Safari / Android Chrome）開啟瀏覽器網址（例如 `http://192.168.10.156:8765/`），即可隨時隨地與 3D 桌面虛擬伴侶互動。

---

## 2. 核心架構改造

### 2.1 後端架構 (FastAPI 靜態檔案託管 + 外部網路監聽)
1. **啟用全介面監聽**：
   - 將 Uvicorn 啟動參數由 `--host 127.0.0.1` 變更為 `--host 0.0.0.0`，允許同一區域網路內的手機訪問。
2. **FastAPI StaticFiles 掛載**：
   - `/assets` -> `assets/`（提供 VRM 3D 模型與貼圖）
   - `/node_modules` -> `node_modules/`（提供 Three.js 與 @pixiv/three-vrm 模組）
   - `/src` -> `src/`（提供前端核心與邏輯代碼）
   - `/` -> 直接回傳手機專屬/自適應之首頁 `index.html`。

### 2.2 前端適配 (行動端手勢與響應式介面)
1. **動態 Hostname 解析**：
   - 將 `ConversationManager.js` 與 `SettingsModal.js` 寫死的 `http://127.0.0.1:8765` 改為動態取得：
     ```javascript
     const baseUrl = window.location.origin; // 自動對應手機連入之 IP 與 Port
     ```
2. **觸控手勢控制器 (Mobile Touch Controls)**：
   - **單指滑動**：取代滑鼠右鍵拖曳，驅動相機方位角（Orbit Theta）與仰角（Orbit Phi）進行 360 度環繞。
   - **雙指捏合 (Pinch to Zoom)**：計算兩指觸控點間距，平滑調整相機距離（特寫/全身縮放）。
   - **單指輕點**：透過觸控座標投射 Raycast，進行頭部摸頭互動。
3. **行動端音訊解鎖 (Audio Autoplay Policy)**：
   - 在首次進入網頁時提供「點擊喚醒」開場互動，使用者觸控時解鎖 Web Audio `AudioContext.resume()`，確保後續 Edge-TTS 語音播放順暢。
4. **手機底部抽屜式聊天視窗 (Mobile Chat Drawer)**：
   - 點擊對話時由底部彈出抽屜式文字聊天窗，避免虛擬鍵盤遮擋 3D 角色。

---

## 3. 實作計畫 (Implementation Plan)

1. **後端變更**：
   - 在 `backend/app.py` 中掛載 `StaticFiles` 並新增 `/` 首頁路由。
   - 在 `run.ps1` 與 `run.bat` 中將 `--host 127.0.0.1` 改為 `--host 0.0.0.0`。
2. **前端變更**：
   - 在 `src/renderer/core/SceneManager.js` 增加觸控監聽（`touchstart`、`touchmove`、`touchend`），支援單指滑動旋轉與雙指捏合縮放。
   - 在 `src/renderer/core/RaycastManager.js` 增加 `touchstart` / `touchend` 點擊摸頭判定。
   - 在 `src/renderer/services/ConversationManager.js` 與 `src/renderer/app.js` 將 API 基底位址改為相對路徑或 `window.location.origin`。
   - 增加行動端音訊點擊解鎖機制。
