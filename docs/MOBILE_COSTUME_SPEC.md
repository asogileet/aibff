# 手機版角色切換與載入反饋規格文件 (Mobile Costume & Character Switch Spec)

## 1. 問題現象與根因分析 (Root Cause Analysis)

### 1.1 使用者反映現象
- 在手機瀏覽器（例如 Safari / Chrome）開啟 `http://192.168.10.156:8765/` 時，無法順利切換角色（或換裝），甚至出現點擊無反應、角色沒有替換之情況。

### 1.2 核心根因分析
1. **模型路徑解析差異 (Path Resolution in Web Browser)**：
   - 原先在 `AvatarController.js` 中使用相對路徑：
     ```javascript
     this.costumePaths = {
       casual: '../../assets/models/costume_casual.vrm',
       ayame: '../../assets/models/ayame.vrm',
       mint: '../../assets/models/mint_swimsuit.vrm'
     };
     ```
   - 在桌面 Electron（`file:///` 協議載入 `src/renderer/index.html`）下，`../../assets` 會正常指向專案根目錄的 `assets`。
   - 但在 Web 伺服器根目錄（`http://192.168.10.156:8765/`）下，部分行動瀏覽器在解析相對於根目錄的 `../../` 時，容易造成層級混亂或 404，需在 Web 模式下動態解析為絕對路徑 `/assets/models/...`。
2. **大型 VRM 模型缺乏「載入中」狀態提示 (Lack of Loading State)**：
   - 角色模型如百鬼綾目 (`ayame.vrm`, 15.5 MB) 與泳裝薄荷 (`mint_swimsuit.vrm`, 18.4 MB) 體積較大。
   - 在手機 Wi-Fi 下載與解析需耗時 2~5 秒。原先在點擊後立即播放 1.4 秒轉圈動畫，若動畫結束時模型尚未下載完成，模型仍維持原貌，讓使用者誤以為「不能換角色」。
   - 當 `loadCostume()` 發生任何網路中斷或例外時，原本的 `catch` 會靜默回傳舊模型（`if (this.currentVRM) return this.currentVRM;`），完全沒有跳出錯誤訊息或氣泡提示。
3. **UI 工具列與換裝選單定位重疊 (Layout & Z-Index Positioning)**：
   - 原先 `Toolbar.js` 缺少 `fixed bottom-6 left-1/2 -translate-x-1/2`，導致在無絕對定位的 `ui-container` 中被預設頂在畫面最上方；而 `CostumeSelector.js` 卻固定在 `bottom-20`，上下脫節且容易被行動瀏覽器底部虛擬工具列遮擋。
   - 選單寬度需自適應窄螢幕手機（`w-[90vw] max-w-sm`），並在彈出時正確啟用 `pointer-events: auto`。
4. **自然語言「換角色」觸發支援**：
   - 若使用者透過對話框輸入「換角色」、「切換角色」或「換衣服」，後端規則需支援智慧輪換，直接切換到下一位可用角色（如綾目或薄荷）。

---

## 2. 改善方案與架構設計

### 2.1 路徑動態解析標準化
- 統一在 `AvatarController.js` 引入環境偵測：
  ```javascript
  const isWeb = typeof window !== 'undefined' && !window.electronAPI;
  const modelDir = isWeb ? '/assets/models/' : '../../assets/models/';
  ```
  確保 Web 模式下一律精確請求 `/assets/models/ayame.vrm`、`/assets/models/mint_swimsuit.vrm`。

### 2.2 載入狀態與對話氣泡即時回饋
- 於切換角色發起時，立即：
  1. 對話氣泡顯示「正在切換至【角色名稱】，請稍候一下下唷～✨」。
  2. 換裝按鈕呈現載入進度或禁用重複點擊。
  3. 下載與編譯完成後，旋轉完成並觸發對應專屬角色問候台詞與粒子特效。
  4. 若下載失敗，彈出「角色模型載入失敗，請確認網路連線」警示氣泡。

### 2.3 手機版面配置與觸控最佳化
- `Toolbar`: 加上 `fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[95vw]`。
- `CostumeSelector`: 改為 `fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-sm`，確保在各種手機尺寸皆置中且位於工具列上方。
- 支援 `touchstart` 與 `click` 雙重事件保證，防止行動端點擊穿透或延遲。

### 2.4 對話意圖支援通用「換角色」關鍵字
- 於 `backend/llm/ollama_client.py` 增強關鍵字解析：
  - 遇到「換角色」、「切換角色」、「下一個角色」時，自動切換至當前角色以外的下一個主要角色（小櫻 ⇄ 百鬼綾目 ⇄ 泳裝薄荷）。
