# 上下方工具列捲軸消除與對話框折疊/全展開規格說明書
(Toolbar Scrollbar Removal, Top/Bottom Dialogue Collapse & Full Expand Specification)

## 1. 背景與現有問題

1. **水平捲軸干擾 (Scrollbar Artifact)**：
   - **上方工具列 (`MultiAvatarBar`)**：`#cloneSlotsContainer` 設有 `overflow-x-auto`，在 Windows 11 Chromium 引擎下會強行繪製出 Windows 原生白色粗厚水平捲軸，影響視覺美觀且遮蔽操作鈕。
   - **下方工具列 (`Toolbar`)**：`#bottomToolbar` 外層設有 `overflow-x-auto`，在低解析度或視窗寬度縮小時，底部會出現原生水平捲軸。

2. **上方工具列無法直接隱藏 (Missing Hide Control)**：
   - 先前版本未啟用影分身時頂部是乾淨透明的；而在加入 `MultiAvatarBar` 後，預設常駐於頂部，但工具列本體卻**未提供收起/關閉按鈕**，使用者無法在頂部直接隱藏，造成「原本上方的可以隱藏，現在怎麼不見了？」的困惑。

3. **上下對話框互相遮擋與缺乏折疊/展開 (Dialog Overlapping & Scaling)**：
   - **上方對話氣泡 (`#dialogueBubble`)**：定位於固定 `top-8`，當上方工具列存在時，兩者直接重疊互撞，且遮擋中央 3D 角色的臉部；原本被設為 `pointer-events-none`，缺乏收起、展開與手動關閉操作。
   - **下方聊天視窗 (`ChatBox`)**：固定於 `bottom-20` 且置中，直接擋在 3D 人偶正前方；固定尺寸為 `h-44`，僅有關閉鈕 (✕)，無法一鍵收起最小化，也無法全展開放大檢視長篇對話。

---

## 2. 規格設計

### 2.1 工具列滾動軸全面隱藏 (Scrollbar-Free Clean UI)
- 在 `style.css` 封裝全瀏覽器通用的 `.no-scrollbar`：
  ```css
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  ```
- 上方工具列的 `#cloneSlotsContainer` 與外層容器加入 `.no-scrollbar`，保留滾輪橫向滾動與觸控拖動能力，但隱藏任何原生捲軸。
- 下方工具列 `#bottomToolbar` 套用 `.no-scrollbar`，確保各種螢幕尺寸下皆保持邊框平滑無捲軸。

### 2.2 上方工具列新增收起/隱藏控制與微型展開標籤
- 在 `MultiAvatarBar` 右側新增收起/隱藏按鈕 `[✕ 收起]` 或 `[🔼]`。
- 點擊收起時：
  - 工具列可平滑向上淡出隱藏，並在螢幕頂部中央保留一個極簡微型的「👥 影分身」小膠囊標籤（或與下方工具列同步切換）。
  - 下方 Toolbar 的 `btnClone` 狀態同步更新為非啟用狀態。
  - 再次點擊頂部微型膠囊或下方「分身」按鈕即可平滑還原展開。

### 2.3 上方對話氣泡避讓與互動控制 (Dialogue Bubble)
- **智慧避讓定位 (Smart Dynamic Positioning)**：
  - 當上方工具列（`MultiAvatarBar` 或 `PuppetPoseBar`）可見時，對話氣泡自動避讓位移至 `top-16` / `top-20`，避免遮擋工具列。
  - 當上方工具列收起或隱藏時，對話氣泡自動平滑上移至 `top-6`，貼近頂部。
- **互動與收折能力**：
  - 啟用 `pointer-events-auto`。
  - 氣泡右上角新增控制群組：
    - `[─]` **收起**：縮小為僅顯示情緒小圖示膠囊（例如 `😊`），不擋住桌面視線與 3D 角色。
    - `[⤢]` **全展開**：文字過長時展開完整段落，支援自動換行與捲動。
    - `[✕]` **關閉**：立即關閉當前氣泡。
  - 滑鼠懸停時自動暫停定時消失計時器，移開後恢復倒數。

### 2.4 下方文字對話框 (ChatBox) 折疊與全展開
- **三態視窗控制 (Window Controls)**：
  - ─ **收起 (Minimize)**：折疊為簡潔的一行輸入膠囊，吸附在工具列上方，完全不遮擋 3D 人偶。
  - ⛶ **全展開 (Maximize / Expand)**：擴大視窗尺寸（從預設 `max-w-sm h-44` 擴展至 `max-w-xl h-96`），提升文字檢視容量與代碼閱讀體驗。
  - ✕ **關閉 (Close)**：直接關閉聊天面板。
- **停靠避讓 (Dock Position)**：
  - 支援快速切換置中或靠右停靠，讓使用者在對話時不會遮擋中央的主角人偶。

---

## 3. 架構影響範圍

1. `src/renderer/style.css`：新增 `.no-scrollbar` 與動態偏移、尺寸過渡 class。
2. `src/renderer/index.html`：調整 `#dialogueBubble` 結構，增加控制按鈕與互動樣式。
3. `src/renderer/ui/MultiAvatarBar.js`：新增右上角收折/隱藏按鈕與頂部微型膠囊切換。
4. `src/renderer/ui/Toolbar.js`：移除捲軸顯示，確保樣式乾淨。
5. `src/renderer/ui/ChatBox.js`：新增最小化/收起、最大化/全展開、置中/靠右停靠控制。
6. `src/renderer/app.js`：整合對話氣泡智慧避讓（依據上方工具列顯示狀態動態計算頂部距離）。
