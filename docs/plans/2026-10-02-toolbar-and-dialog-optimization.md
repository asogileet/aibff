# 上下方工具列無捲軸與對話框折疊/展開 實作計畫 (Implementation Plan)

## 1. 問題成因分析

1. **工具列水平捲軸問題**：
   - 上方影分身工具列 (`MultiAvatarBar.js`) 的 `#cloneSlotsContainer` 具備 `overflow-x-auto`，在 Windows 11 Chromium 引擎下強制繪製出灰白色的原生粗橫向捲軸。
   - 下方工具列 (`Toolbar.js`) 外層容器亦為 `overflow-x-auto`，寬度超出或受視窗限制時產生原生捲軸。
2. **上方工具列「原本可隱藏現在不見了」成因**：
   - 舊版未新增影分身時，頂部無此控制列（只有玩偶模式開啟時有 PuppetPoseBar）；新增 `MultiAvatarBar` 後被設定為預設顯示，但**控制列本體右側未設計關閉/收起按鈕**，使用者無法在頂部直接隱藏，造成「原本上方是乾淨/可隱藏的，現在怎麼無法隱藏了」的困擾。
3. **對話框遮擋與缺乏收折/全展開**：
   - **上方氣泡 (`#dialogueBubble`)**：固定在 `top-8`，上方工具列存在時直接撞在一起、互相遮蔽，且擋住角色臉部，且原先為 `pointer-events-none` 無法進行點擊收折。
   - **下方聊天視窗 (`ChatBox`)**：固定在 `bottom-20` 置中，直接阻擋畫面中央主角人偶；僅有關閉鈕，缺乏收起（最小化膠囊）與全展開（大視窗檢視長對話與代碼）功能。

---

## 2. 實作規劃步驟

### 步驟一：CSS 捲軸全面消除與過渡類別 (`src/renderer/style.css`)
- 加入跨瀏覽器 `.no-scrollbar` 工具類別：
  ```css
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  ```
- 支援對話氣泡動態避讓位置類別（例如 `.bubble-offset-top`、`.bubble-dock-top`）。

### 步驟二：上方工具列 (`src/renderer/ui/MultiAvatarBar.js`) 增設收折與消除捲軸
- 在 `#cloneSlotsContainer` 與外層加上 `.no-scrollbar`，消除原生水平捲軸，並保留滾輪平滑滑動支援。
- 在工具列右端新增「✕ 收起」按鈕：
  - 點擊後平滑隱藏，並在頂端中央顯示極簡微型膠囊「👥 影分身 (點擊展開)」或直接收折。
  - 同時連動下方工具列分身按鈕（同步切換高亮啟用狀態）。
  - 下方工具列點擊「分身」按鈕亦能雙向同步開啟或隱藏。

### 步驟三：上方對話氣泡智慧避讓與收折 (`src/renderer/index.html` & `src/renderer/app.js`)
- 移除 `pointer-events-none`，改為 `pointer-events-auto`。
- 在氣泡內新增操作工具群組：
  - `[─]`：收起為極簡表情小標籤（例如 `😊`），不擋住視線與人偶。
  - `[⤢]`：展開長訊息（切換多行與單行限制）。
  - `[✕]`：手動立即關閉。
- 在 `app.js` 加入動態避讓計算：
  - 若 `MultiAvatarBar` 或 `PuppetPoseBar` 顯示中，氣泡位置動態避讓至 `top-16` / `top-20`。
  - 若上方工具列均為隱藏狀態，氣泡平滑自動上移至 `top-6`，貼近頂部。

### 步驟四：下方文字對話框 (`src/renderer/ui/ChatBox.js`) 視窗三態與停靠
- 標題列新增視窗控制三合一：
  - `[─]` 收起：折疊為精簡的單行懸浮輸入膠囊，不擋住 3D 角色。
  - `[⛶]` 全展開：切換至放大寬螢幕尺寸（寬度展開至 `max-w-2xl`，高度擴展至 `h-96`），提升閱讀體驗。
  - `[✕]` 關閉：關閉對話視窗。
- 新增 `[📍 靠右停靠 / 置中停靠]` 切換鈕：可將對話框移至右下角 (`right-6 bottom-20`)，徹底避免擋住正中央的 3D 人偶。
- 工具列消除水平捲軸 (`.no-scrollbar`)。

---

## 3. 變更檔案清單

| 檔案路徑 | 變更性質 | 變更內容摘要 |
|---|---|---|
| `docs/TOOLBAR_AND_CHATBOX_OPTIMIZATION_SPEC.md` | 新增 | 規格需求與技術設計文件（已建立） |
| `mockup/toolbar_and_dialog_optimization_mockup.html` | 新增 | 互動式 HTML 驗證原型（已建立） |
| `mockup/index.html` | 修改 | Mockup 導航選單更新（已建立） |
| `src/renderer/style.css` | 修改 | 封裝 `.no-scrollbar` 與避讓定位過渡 class |
| `src/renderer/index.html` | 修改 | 對話氣泡增設互動控制元件群組 |
| `src/renderer/ui/MultiAvatarBar.js` | 修改 | 消除捲軸，右側新增收折按鈕與微型還原膠囊 |
| `src/renderer/ui/Toolbar.js` | 修改 | 消除捲軸，同步連動影分身狀態 |
| `src/renderer/ui/ChatBox.js` | 修改 | 新增三態視窗控制（收起、全展開、關閉）與靠右避讓停靠 |
| `src/renderer/app.js` | 修改 | 整合上方對話氣泡之動態智慧避讓邏輯 |
