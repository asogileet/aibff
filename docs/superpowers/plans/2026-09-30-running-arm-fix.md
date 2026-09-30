# 跑步手臂擺動方向與前屈手肘修正實作計畫 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正跑步時手臂擺動相位相反與同手同腳問題，使左腿向前邁出時右臂向前擺動、右腿向前邁出時左臂向前擺動（嚴格符合人體對側交叉運動學）；同時將手肘從不自然的外翻 Y 軸修正為標準的向前屈肘 90 度 ($+X$)。

**Architecture:** 
1. 在 `AnimationController.js` 的 `case 'run'` 中，反轉左上臂與右上臂的前後擺動正負相位符號。
2. 將小臂 (`leftLowerArm`, `rightLowerArm`) 改為標準向前屈曲 `rotation.set(1.35, 0, 0)`，使小臂保持在胸前自然擺動，而非側向外翻。

**Tech Stack:** Three.js r174 (VRM Normalized Humanoid Arm & Leg Kinematics), Vanilla JS ES6+.

## Global Constraints

* 作業系統：Windows 11（終端機指令限用 PowerShell/CMD）。
* 溝通與計畫一律使用繁體中文輸出。
* 新增程式碼註解必須使用英文（English）。
* 既有註解直接維持原樣，嚴禁擅自翻譯。
* 未獲使用者授權同意前，嚴禁修改現有核心程式碼。
* 測試限制：修改完成後嚴禁自動啟動測試，必須先徵得使用者授權。

---

### Task 1: 修正跑步手臂擺臂相位與屈肘 (`AnimationController.js`)

**Files:**
- Modify: `src/renderer/vrm/AnimationController.js`

**Interfaces:**
- Produces:
  - Correct contralateral arm swing:
    `leftUpperArm.rotation.x = swing * 0.65`
    `rightUpperArm.rotation.x = -swing * 0.65`
  - Proper 90-degree forward elbow flexion:
    `leftLowerArm.rotation.set(1.35, 0, 0)`
    `rightLowerArm.rotation.set(1.35, 0, 0)`

- [ ] **Step 1: 反轉上臂前後擺動相位符號**
  - 當左腿向前抬起（`swing > 0`）時，右臂向前擺動、左臂向後擺動。
  - 將 `leftUpperArm.rotation.x` 與 `rightUpperArm.rotation.x` 的相位正負號對調。
- [ ] **Step 2: 修正小臂手肘軸向**
  - 將原本錯誤的 `lowerArm.rotation.y = 1.15` 改為繞 X 軸的向前自然屈肘 `lowerArm.rotation.set(1.35, 0, 0)`。
  - 調整 `upperArm.rotation.z` 角度使手臂自然貼近軀幹兩側。
