# 3D 標準動作庫、工具列動作選單與指令控制實作計畫 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 10 大標準角色動作庫（胸前比愛心、禮貌鞠躬、鼓掌拍手、歪頭賣萌、伸個懶腰、歡呼雀躍、點頭同意、搖頭否定、生氣叉腰、熱情揮手），新增底部工具列「動作」彈出面板 (`ActionSelector`)，並支援文字/語音自然語言對話與斜線指令（`/heart`, `/bow` 等）即時驅動角色執行對應動作。

**Architecture:** 
1. 在 `AnimationController.js` 擴充標準骨骼動力學與動作時間軸狀態機，實現 10 大動作的平滑插值與復位。
2. 在 `ActionController.js` 擴充動作分發邏輯，整合愛心粒子、表情切換與專屬語音對白。
3. 建立獨立 UI 組件 `src/renderer/ui/ActionSelector.js`，並於 `Toolbar.js` 新增「💃 動作」按鈕進行開關。
4. 在 `ConversationManager.js` 攔截斜線指令（Slash Commands），並在後端 `ollama_client.py` 擴充 10 大動作的中文自然語言意圖識別詞庫。

**Tech Stack:** Three.js r174 (Humanoid Bone Kinematics & Interpolation), Vanilla JS ES6+, Electron 34, Tailwind CSS, Python FastAPI (Ollama LLM).

## Global Constraints

* 作業系統：Windows 11（終端機指令限用 PowerShell/CMD）。
* 溝通與計畫一律使用繁體中文輸出。
* 新增程式碼註解、XML 文件註解、TODO 必須使用英文（English）。
* 既有註解直接維持原樣，嚴禁擅自翻譯。
* 未獲使用者授權同意前，嚴禁修改現有核心程式碼。
* 測試限制：修改完成後嚴禁自動啟動測試，必須先徵得使用者授權。

---

### Task 1: 建立 10 大標準動作骨骼控制器 (`AnimationController.js`)

**Files:**
- Modify: `src/renderer/vrm/AnimationController.js`

**Interfaces:**
- Produces:
  - `AnimationController.prototype.playAction(actionName: string, onComplete?: () => void): void`
  - 專屬動作方法：`playHeartPose()`, `playBow()`, `playClap()`, `playTiltHead()`, `playStretch()`, `playCheer()`, `playNod()`, `playShakeHead()`, `playPout()`, `playWave()`

- [ ] **Step 1: 定義動作狀態與參數計時器**
  - 在 `AnimationController` 中增加各動作時間軸長度常數與骨骼角度變數。
- [ ] **Step 2: 實作 10 種骨骼補間運算**
  - 在 `_updateActions(delta, vrm)` 依據目前 `currentAction` 計算：
    1. `heart_pose` (3.0s)：雙手上胸交疊比心，手掌與手臂平滑聚合。
    2. `bow` (2.5s)：脊椎 `spine` 前傾 25 度、雙手收攏、頭部微垂。
    3. `clap` (2.8s)：雙手於胸前以 6Hz 正弦頻率快速拍手 4 次。
    4. `tilt_head` (2.0s)：頭部 `head` 側傾 18 度，維持甜美萌態。
    5. `stretch` (3.2s)：雙臂高舉過頂向兩側伸展，身體後仰放鬆。
    6. `cheer` (2.6s)：雙手高舉揮舞、身體微幅彈跳。
    7. `nod` (1.8s)：頭頸快速連續俯仰 2 次。
    8. `shake_head` (1.8s)：頭頸左右平滑搖動 2 次。
    9. `pout` (2.8s)：手肘向外彎折叉腰，頭微撇。
    10. `wave` (2.5s)：右手抬起熱情搖擺（現有功能強化）。
- [ ] **Step 3: 動作結束後的平滑歸位**
  - 動作時間到達上限後，骨骼平滑 Lerp 回待機標準姿態 (`resetToIdle`)。

---

### Task 2: 動作調度器與專屬台詞粒子整合 (`ActionController.js`)

**Files:**
- Modify: `src/renderer/vrm/ActionController.js`

**Interfaces:**
- Produces:
  - 支援 10 種 action 分發 (`heart_pose`, `bow`, `clap`, `tilt_head`, `stretch`, `cheer`, `nod`, `shake_head`, `pout`, `wave`)
  - 內建各動作隨機互動台詞庫與表情映射

- [ ] **Step 1: 建立各動作台詞庫與表情關聯**
  - 為 `heart_pose`（害羞/甜蜜）、`bow`（感謝）、`clap`（讚賞）、`cheer`（興奮）、`pout`（生氣嬌嗔）等設定專屬預設對白與表情。
- [ ] **Step 2: 擴充 `ActionController.dispatch()`**
  - 在 switch-case 中對應各動作方法，比心動作同時觸發 10 顆愛心粒子 (`spawnHeartParticles(10)`)。

---

### Task 3: 建立工具列動作選單浮動面板 (`ActionSelector.js` 與 `Toolbar.js`)

**Files:**
- Create: `src/renderer/ui/ActionSelector.js`
- Modify: `src/renderer/ui/Toolbar.js`
- Modify: `src/renderer/app.js`

**Interfaces:**
- Consumes: `onSelectAction: (actionKey: string) => void`
- Produces: `ActionSelector.prototype.toggle(show?: boolean): void`

- [ ] **Step 1: 建立 `src/renderer/ui/ActionSelector.js`**
  - 建立具毛玻璃質感的半透明浮動卡片面板。
  - 排版 10 個動作按鈕，標示 Emoji 圖示與繁體中文名稱。
  - 點擊按鈕時呼叫回呼函式並關閉面板。
- [ ] **Step 2: 修改 `Toolbar.js` 加入「💃 動作」按鈕**
  - 在工具列中加入動作按鈕與 `onAction` 點擊處理。
- [ ] **Step 3: 在 `app.js` 串聯 `actionSelector` 與 `actionController`**
  - 點擊動作按鈕後，立即調用 `actionController.dispatch({ action: key })`。

---

### Task 4: 指令與對話自然語言意圖整合 (`ConversationManager.js` 與 `ollama_client.py`)

**Files:**
- Modify: `src/renderer/services/ConversationManager.js`
- Modify: `backend/llm/ollama_client.py`

**Interfaces:**
- Consumes: User message string
- Produces: Structured intent with matched action tag

- [ ] **Step 1: 在前端 `ConversationManager.js` 支援 Slash Commands**
  - 若使用者輸入 `/heart`, `/bow`, `/clap`, `/tilt`, `/stretch`, `/nod`, `/shake`, `/cheer`, `/pout`, `/wave`，直接在前端本機攔截並執行動作，不需額外等待 LLM 延遲。
- [ ] **Step 2: 在後端 `ollama_client.py` 擴充自然語言詞庫**
  - 在 `_extract_intent()` 加入對應關鍵字辨識：
    - 「愛心 / 比心」 $\rightarrow$ `heart_pose`
    - 「鞠躬 / 謝謝 / 感謝」 $\rightarrow$ `bow`
    - 「拍手 / 鼓掌 / 好棒」 $\rightarrow$ `clap`
    - 「歪頭 / 賣萌」 $\rightarrow$ `tilt_head`
    - 「好累 / 伸懶腰 / 放鬆」 $\rightarrow$ `stretch`
    - 「點頭 / 可以 / 沒問題」 $\rightarrow$ `nod`
    - 「不要 / 搖頭 / 不行」 $\rightarrow$ `shake_head`
    - 「太好了 / 慶祝 / 歡呼」 $\rightarrow$ `cheer`
    - 「生氣 / 哼 / 叉腰」 $\rightarrow$ `pout`
