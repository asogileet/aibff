# 下肢關節轉向修正與持續姿態維持 (Action Holding) 實作計畫 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正下肢大腿與膝蓋骨骼旋轉軸向，使坐下、蹲下、跪下、跑步等關節向度完全符合人體工學（大腿向前伸為 $+X$、膝蓋向後折曲為 $-X$）；改為「持續維持姿態（Holding）」直到更換動作或下達「站起來」指令，並擴充「站立待機 (`stand`)」控制。

**Architecture:** 
1. 在 `AnimationController.js` 調整坐姿、跑步、蹲下、跪坐、跳躍之 `upperLeg` 與 `lowerLeg` 旋轉正負號，徹底修正反關節問題。
2. 移除 `sit`, `squat`, `kneel`, `run` 之自動定時復原計時器，轉為長駐狀態機（Persistent Posture State），直到下達新動作或站立指令。
3. 在 `ActionSelector.js` 加入「🧍 站立待機 (`stand`)」控制項。
4. 在 `ActionController.js`、`ConversationManager.js` 與後端 `ollama_client.py` 串接「站起來 / `/stand`」指令。

**Tech Stack:** Three.js r174 (VRM Normalized Humanoid Bone Rotations), Vanilla JS ES6+, Electron 34, Tailwind CSS, Python FastAPI (Ollama LLM).

## Global Constraints

* 作業系統：Windows 11（終端機指令限用 PowerShell/CMD）。
* 溝通與計畫一律使用繁體中文輸出。
* 新增程式碼註解必須使用英文（English）。
* 既有註解直接維持原樣，嚴禁擅自翻譯。
* 未獲使用者授權同意前，嚴禁修改現有核心程式碼。
* 測試限制：修改完成後嚴禁自動啟動測試，必須先徵得使用者授權。

---

### Task 1: 修正下肢關節旋轉軸向 (`AnimationController.js`)

**Files:**
- Modify: `src/renderer/vrm/AnimationController.js`

**Interfaces:**
- Produces: Correct anatomical rotation values:
  - `upperLeg.rotation.x`: Positive values for forward thigh flexion
  - `lowerLeg.rotation.x`: Negative values for backward knee flexion

- [ ] **Step 1: 修正 `sit`（坐下）關節方向**
  - 大腿 `leftUpperLeg.rotation.x = +1.52`, `rightUpperLeg.rotation.x = +1.52`（向前伸平）。
  - 小腿 `leftLowerLeg.rotation.x = -1.55`, `rightLowerLeg.rotation.x = -1.55`（膝蓋向下折）。
- [ ] **Step 2: 修正 `run`（跑步）關節方向**
  - 小腿向後踢折：`leftLowerLeg.rotation.x = -Math.max(0, -swing * 1.3)`、`rightLowerLeg.rotation.x = -Math.max(0, swing * 1.3)`。
- [ ] **Step 3: 修正 `squat`（蹲下）關節方向**
  - 大腿上抬 `+1.75`，小腿後折 `-2.15`。
- [ ] **Step 4: 修正 `kneel`（跪下）關節方向**
  - 大腿端正 `+0.15`，小腿後折平貼地面 `-2.45`。
- [ ] **Step 5: 修正 `jump`（跳躍）蓄力與落地緩衝關節方向**
  - 膝蓋微向後屈曲：`lowerLeg.rotation.x = -0.8 * t`。

---

### Task 2: 實作姿態持續維持模式（Action Holding）(`AnimationController.js`)

**Files:**
- Modify: `src/renderer/vrm/AnimationController.js`

**Interfaces:**
- Produces:
  - `sit`, `squat`, `kneel` 達到目標姿態後維持 `prog = 1.0`，不再定時呼叫 `resetToIdle()`
  - `run` 步頻無限循環，直到被其他動作中斷

- [ ] **Step 1: 移除 `sit` 之超時還原邏輯**
  - 達到 0.8 秒過渡後，維持坐姿不變。
- [ ] **Step 2: 移除 `squat` 與 `kneel` 之超時還原邏輯**
  - 達到過渡後，維持蹲姿與跪坐姿勢不變。
- [ ] **Step 3: 移除 `run` 之 3.5s 強制停止**
  - 維持跑步步頻與微起伏，直到使用者要求停止或更換動作。

---

### Task 3: 擴充「站立待機 (`stand` / `idle`)」控制與按鈕

**Files:**
- Modify: `src/renderer/ui/ActionSelector.js`
- Modify: `src/renderer/vrm/ActionController.js`
- Modify: `src/renderer/services/ConversationManager.js`
- Modify: `backend/llm/ollama_client.py`

**Interfaces:**
- Produces:
  - ActionSelector 新增「🧍 站立待機」卡片
  - 支援 `/stand`, `/stop`, `/idle`, `/up`
  - 支援語音/對話「站起來」、「起來」、「站好」、「停下來」

- [ ] **Step 1: 在 `ActionSelector.js` 加入「🧍 站立待機 (`stand`)」項目**
- [ ] **Step 2: 在 `ActionController.js` 加入 `stand` 處理**
  - 調用 `this.animationController.resetToIdle()`，台詞「小櫻站好囉！主人還有什麼想看的動作嗎？」
- [ ] **Step 3: 在 `ConversationManager.js` 加入 `/stand`, `/stop`, `/up` 快捷指令與 Fallback 關鍵字**
- [ ] **Step 4: 在 `ollama_client.py` 加入「站起來 / 起來 / 站好 / 停下來」意圖辨識**
