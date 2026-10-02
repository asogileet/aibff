# 自訂動作姿勢儲存修復與互動輸入體驗升級規格文件

## 1. 問題診斷與根本原因分析

使用者反饋「儲存動作姿勢是不是壞了，我存半天沒有成功」，經過系統性排查，確認根本原因如下：

### 1.1 玩偶捏人模式 (Puppet Mode) 中的致命 Bug：`window.prompt()` 失效
- **位置**：`src/renderer/ui/PuppetPoseBar.js` 之 `promptSavePose()`
- **原因**：Electron 桌面端環境的 Chromium 渲染進程 **並未實作瀏覽器原生的 `window.prompt()` 對話框**。當呼叫 `window.prompt(...)` 時，Electron 直接靜默回傳 `null`，完全不會彈出任何輸入框。
- **連鎖反應**：
  ```javascript
  const name = window.prompt('請輸入新姿勢名稱：', defaultName);
  if (name === null) return; // 這裡永遠為 true，直接中斷離開！
  this.puppetController.saveCurrentPose(trimmed); // 永遠無法被執行
  ```
  使用者在捏人完成後點選「💾 存為新姿勢」，畫面毫無反應、沒有跳出錯誤訊息也沒有對話框，導致「存半天沒有成功」。

### 1.2 骨架關節微調面板 (`PoseModal.js`) 姿態未自動同步
- **位置**：`src/renderer/ui/PoseModal.js`
- **原因**：當使用者在 21 大動作庫選擇動作（如坐姿、蹲姿、跪姿）或微調模型後，點開 `PoseModal` 面板時，面板僅更新自身滑桿顯示，**並未主動從 active VRM 捕捉當前真實姿態 (`captureCurrentPoseFromAvatar()`)**。
- **結果**：面板的暫存旋轉數值仍維持預設站姿（全 0°）。若使用者直接輸入名稱並儲存，存下來的是預設站姿而非畫面上擺出的動作姿勢，點擊「套用」時動作會跳回預設站姿，讓使用者誤以為儲存無效。
- **缺少鍵盤便利性**：輸入名稱後按鍵盤 `Enter` 鍵不會觸發儲存。

---

## 2. 升級與修復方案

### 2.1 PuppetPoseBar：內建輕量級玻璃擬態輸入彈窗 (Inline Popover)
- 點選「💾 存為新姿勢」時，在 PuppetPoseBar 下方優雅彈出內嵌卡片（含陰影與霓虹粉光）。
- 提供輸入框，預設文字「玩偶姿勢 #N」，打開時自動聚焦並全選文字。
- 提供「儲存」與「取消」按鈕，支援鍵盤 `Enter` 立即儲存、`Esc` 關閉。
- 儲存時先自動呼叫 `poseManager.captureCurrentPoseFromAvatar()` 鎖定當前肢體與關節狀態，再進行持久化存檔。
- 儲存完成後，即時刷新 `PoseModal` 的姿勢快捷清單，並顯示對話氣泡提示。

### 2.2 PoseModal：開啟自動捕捉與體驗強化
- 開啟面板 (`toggle(true)`) 時，自動調用 `poseManager.captureCurrentPoseFromAvatar()`，讓面板各軸角度即時反映畫面中的動作或捏人狀態。
- 增加 `inputNewPoseName` 的 `Enter` 鍵監聽，使用者打完字按下 Enter 即可儲存。
- 若名稱為空，改為溫和的對話氣泡提示「請輸入姿勢名稱哦～」，避免呼叫阻斷式原生 `alert()`。

---

## 3. 測試與驗證規劃 (待授權後執行)
- 模擬 Electron 環境，驗證點擊「存為新姿勢」能否正確彈出輸入框、確認存檔並寫入 `localStorage` (`aibff_custom_poses`)。
- 驗證儲存後的姿勢能在 `PoseModal` 與 `/pose` 指令中正確列出並套用還原。
