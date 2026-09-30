# 全身下肢動作擴充（坐下、跑步、跳起來、蹲下、跪下）實作計畫 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 擴充 5 大全身與下肢動作（坐下 `sit`、原地跑步 `run`、開心跳躍 `jump`、萌萌蹲下 `squat`、正襟跪坐 `kneel`），將動作庫擴充至 15 款動作；同步更新工具列動作面板 (`ActionSelector`)，並支援文字/語音指令（如 `/sit`, `/jump`, 「跳起來」, 「坐下」）直接驅動。

**Architecture:** 
1. 在 `AnimationController.js` 擴充骨骼運動學系統，加入骨盆高度 (`hips.position.y`)、大腿 (`upperLeg`)、小腿 (`lowerLeg`) 以及手臂的全身聯動運算與拋物線彈跳插值。
2. 在 `ActionController.js` 擴充動作分發、專屬語音對白與粒子特效。
3. 在 `ActionSelector.js` 增加 5 款下肢動作卡片（擴充至 15 款）。
4. 在 `ConversationManager.js` 與後端 `ollama_client.py` 擴充斜線指令與中文字詞匹配。

**Tech Stack:** Three.js r174 (VRM Humanoid Leg & Hip Kinematics), Vanilla JS ES6+, Electron 34, Tailwind CSS, Python FastAPI (Ollama LLM).

## Global Constraints

* 作業系統：Windows 11（終端機指令限用 PowerShell/CMD）。
* 溝通與計畫一律使用繁體中文輸出。
* 新增程式碼註解必須使用英文（English）。
* 既有註解直接維持原樣，嚴禁擅自翻譯。
* 未獲使用者授權同意前，嚴禁修改現有核心程式碼。
* 測試限制：修改完成後嚴禁自動啟動測試，必須先徵得使用者授權。

---

### Task 1: 實作 5 大全身下肢骨骼運動學 (`AnimationController.js`)

**Files:**
- Modify: `src/renderer/vrm/AnimationController.js`

**Interfaces:**
- Produces:
  - `playSit(onComplete?: () => void): void`
  - `playRun(onComplete?: () => void): void`
  - `playJump(onComplete?: () => void): void`
  - `playSquat(onComplete?: () => void): void`
  - `playKneel(onComplete?: () => void): void`

- [ ] **Step 1: 定義下肢節點與 Hips 重置機制**
  - 在 `resetToIdle()` 中加入 `hips`, `leftUpperLeg`, `rightUpperLeg`, `leftLowerLeg`, `rightLowerLeg` 節點的復位，確保任何動作結束後骨盆高度平滑回歸預設值。
- [ ] **Step 2: 實作坐下 (Sit，3.5s)**
  - `hips.position.y` 緩降至 `0.42m`。
  - 大腿 `upperLeg.rotation.x = -1.57`，小腿 `lowerLeg.rotation.x = 1.57`，手平放於膝蓋。
- [ ] **Step 3: 實作原地跑步 (Run，3.5s 循環步頻)**
  - 雙腿依正弦曲線交替前後擺動 ($\pm 0.8\text{ rad}$)，膝蓋向後折曲。
  - 手臂屈肘與腿部反向擺動，骨盆微幅輕快起伏。
- [ ] **Step 4: 實作開心跳躍 (Jump，2.0s 滯空拋物線)**
  - 蓄力下蹲 ($0 \sim 0.35\text{s}$) $\rightarrow$ 雙臂高舉滯空騰躍 ($0.35 \sim 1.1\text{s}$，`hips.y` 躍至 $1.15\text{m}$) $\rightarrow$ 落地屈膝緩衝 ($1.1 \sim 1.6\text{s}$) $\rightarrow$ 復原站姿。
- [ ] **Step 5: 實作萌萌蹲下 (Squat / Crouch，3.0s)**
  - `hips.position.y` 下沉至 `0.35m`，膝蓋深度曲折，身體前傾平衡，頭部微抬仰望主人。
- [ ] **Step 6: 實作正襟跪坐 (Kneel / Seiza，3.2s)**
  - 膝蓋著地貼合地面，上身端正挺直，雙手平齊置於大腿前側。

---

### Task 2: 擴充動作調度器與專屬台詞庫 (`ActionController.js`)

**Files:**
- Modify: `src/renderer/vrm/ActionController.js`

**Interfaces:**
- Produces:
  - 支援 `sit`, `run`, `jump`, `squat`, `kneel` 動作分發
  - 專屬台詞與粒子特效

- [ ] **Step 1: 加入 5 大動作專屬對話台詞**
  - `sit`: 「小櫻乖乖坐下了哦，主人要坐在小櫻旁邊嗎？」
  - `run`: 「一、二、一、二！跟主人一起運動跑步真開心！」
  - `jump`: 「嘿咻——！跳得很高吧？小櫻今天活力滿滿呢！」（觸發 8 顆愛心粒子）
  - `squat`: 「蹲在地上抬頭看主人，視角好特別呢～」
  - `kneel`: 「正襟跪坐……主人有什麼重要的事要吩咐小櫻嗎？」
- [ ] **Step 2: 在 `dispatch()` switch-case 串聯各動作方法**

---

### Task 3: 更新動作面板擴充至 15 款動作 (`ActionSelector.js`)

**Files:**
- Modify: `src/renderer/ui/ActionSelector.js`

**Interfaces:**
- Produces: 15 個動作項目排版卡片

- [ ] **Step 1: 在 `this.actions` 中加入 5 個下肢新項目**
  - 🪑 坐下 (`sit`)
  - 🏃 原地跑步 (`run`)
  - 🦘 開心跳躍 (`jump`)
  - 🧘 萌萌蹲下 (`squat`)
  - 🙇 正襟跪坐 (`kneel`)

---

### Task 4: 支援快捷指令與自然語言辨識 (`ConversationManager.js` 與 `ollama_client.py`)

**Files:**
- Modify: `src/renderer/services/ConversationManager.js`
- Modify: `backend/llm/ollama_client.py`

**Interfaces:**
- Consumes: User message string
- Produces: Structured intent with matched action tag

- [ ] **Step 1: 前端 `slashMap` 擴充**
  - `/sit` $\rightarrow$ `sit`
  - `/run` $\rightarrow$ `run`
  - `/jump` $\rightarrow$ `jump`
  - `/squat`, `/crouch` $\rightarrow$ `squat`
  - `/kneel`, `/seiza` $\rightarrow$ `kneel`
- [ ] **Step 2: 前後端中文關鍵字意圖詞庫擴充**
  - 「坐下 / 坐著」 $\rightarrow$ `sit`
  - 「跑步 / 跑起來 / 運動」 $\rightarrow$ `run`
  - 「跳起來 / 跳一下 / 跳躍」 $\rightarrow$ `jump`
  - 「蹲下 / 蹲著」 $\rightarrow$ `squat`
  - 「跪下 / 跪坐 / 跪著」 $\rightarrow$ `kneel`
