# 影分身多角色同台與各別姿勢調整實作計畫 (Multi-Avatar Clones Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 3D 桌面透明視窗中實現「影分身之術」，支援同時加載並渲染 1~4 個獨立 VRM 人偶，提供 3D 射線點選、腳底高亮光圈、自由拖曳腰部站位、獨立換裝與各自拉扯捏人姿勢調整。

**Architecture:** 
1. 建立 `AvatarManager` 多實例容器，取代原先寫死單一 VRM 的邏輯，管理多個 `AvatarSlot`（各自擁有獨立 VRM、服裝、站位偏移量與骨架姿態），並在 Three.js 場景中維護動態追蹤的腳底選取發光環（Ground Selection Ring）。
2. 將 `PuppetController` 與 `PoseManager` 的受控對象抽象為 `avatarManager.getActiveVRM()`，使關節拉扯、站位移動、姿勢預設套用皆精準作用於當前選取之人偶。
3. 建立 `MultiAvatarBar` 浮動 UI 面板並整合至頂部，提供人偶切換標籤、新增分身、移除分身、重整站位與全員姿勢同步按鈕。
4. 升級 `CostumeSelector` 與 3D 射線點選（Raycast），支援點擊任一人偶立即選取，以及針對選中人偶獨立換裝。

**Tech Stack:** Three.js r174, @pixiv/three-vrm 3.3.0, Electron 34, JavaScript (ES6+ Modules, Composition/Manager pattern).

## Global Constraints

- 作業系統：Windows 11，終端機指令必須一律起手使用 Windows (PowerShell/CMD) 指令，嚴禁 Linux 指令。
- 語言規範：Walkthrough 與 Implementation Plan 必須一律使用繁體中文輸出。
- 註解規範：新增的程式碼註解、XML 文件註解、TODO、Debug 訊息一律使用英文；既有中文註解維持原樣。
- 測試限制：修改完成後，嚴禁自動啟動單元測試或 Web 測試，必須先主動詢問取得授權。
- 效能上限：同台人偶數量上限限制為 4 人，兼顧 60 FPS 與 GPU VRAM 資源保護。

---

### Task 1: 建立 AvatarManager 核心控制器與腳底選取光圈 (Ground Selection Ring)

**Files:**
- Create: `src/renderer/vrm/AvatarManager.js`
- Test: Manual inspection in browser / Electron environment

**Interfaces:**
- Produces:
  - `AvatarManager.slots: Array<{ id: string, title: string, vrm: Object, costumeKey: string, position: THREE.Vector3, isSculpted: boolean }>`
  - `AvatarManager.activeIndex: number`
  - `AvatarManager.getActiveVRM(): VRM | null`
  - `AvatarManager.getActiveSlot(): Object | null`
  - `AvatarManager.spawnClone(costumeKey?: string, position?: THREE.Vector3): Promise<Object>`
  - `AvatarManager.removeClone(index: number): boolean`
  - `AvatarManager.selectAvatar(index: number): void`
  - `AvatarManager.syncPoseToAll(sourceIndex?: number): void`
  - `AvatarManager.resetPositions(): void`
  - `AvatarManager.update(delta: number): void`

- [ ] **Step 1: 編寫 `src/renderer/vrm/AvatarManager.js` 實作**

實作完整的多角色實例管理器，具備：
1. 模型路徑解析（相容 Web 與 Electron 路徑）。
2. GLTF / VRM 加載與最佳化（`VRMUtils.removeUnnecessaryVertices`, `VRMUtils.combineSkeletons`）。
3. 腳底發光光圈（`THREE.RingGeometry` 配合發光材質，Y 軸高度 0.005 避免 Z-fighting）。
4. 站位自動排開計算與姿勢同步功能。
5. 正確呼叫 `VRMUtils.deepDispose` 避免記憶體洩漏。

- [ ] **Step 2: 驗證代碼語法與介面匯出無誤**

- [ ] **Step 3: 提交變更**
```bash
git add src/renderer/vrm/AvatarManager.js
git commit -m "feat(vrm): add AvatarManager for multi-avatar slot lifecycle and selection ring"
```

---

### Task 2: 建立 MultiAvatarBar 頂部人偶切換與控制面板

**Files:**
- Create: `src/renderer/ui/MultiAvatarBar.js`
- Modify: `src/renderer/style.css`

**Interfaces:**
- Consumes:
  - `avatarManager: AvatarManager`
- Produces:
  - `MultiAvatarBar.render(): void`
  - `MultiAvatarBar.setVisible(visible: boolean): void`
  - `MultiAvatarBar.updateSlots(): void`

- [ ] **Step 1: 編寫 `src/renderer/ui/MultiAvatarBar.js`**

提供頂部懸浮之人偶分身導覽列：
1. 人偶槽位標籤（`[人偶 ① (主身)] [人偶 ② (分身)]`），選中高亮藍框與呼吸圓點。
2. `✨ 召喚影分身` 按鈕（上限 4 人，滿員時 disabled）。
3. `✕ 移除分身` 按鈕（僅剩 1 人時 disabled）。
4. `📐 重整站位` 按鈕（將同台人偶均勻橫向排開）。
5. `📋 姿勢同步全員` 按鈕（將選中人偶姿勢廣播給所有分身）。
6. 事件回呼綁定至 `avatarManager`。

- [ ] **Step 2: 在 `src/renderer/style.css` 新增樣式支援**

添加透明玻璃擬態與光環呼吸動畫類別。

- [ ] **Step 3: 提交變更**
```bash
git add src/renderer/ui/MultiAvatarBar.js src/renderer/style.css
git commit -m "feat(ui): add MultiAvatarBar component for clone management and slot switching"
```

---

### Task 3: 升級 PuppetController 與 PoseManager 支援多對象操控

**Files:**
- Modify: `src/renderer/vrm/PuppetController.js`
- Modify: `src/renderer/vrm/PoseManager.js`

**Interfaces:**
- Consumes:
  - `avatarManager: AvatarManager`
- Produces:
  - 動態獲取當前選中人偶進行關節拉扯與物理變換。
  - 在拖曳腰部（`hips`）時，調整選中人偶的 `vrm.scene.position.x` 與 `z`，同步更新腳底光圈位置。

- [ ] **Step 1: 修改 `src/renderer/vrm/PuppetController.js`**

1. 將原本直接存取 `this.avatarController.currentVRM` 改為優先從 `this.avatarManager.getActiveVRM()` 取得當前人偶。
2. 在 `_applyJointMovement` 與腰部拖曳時，增加對該人偶世界站位的實時位移支援。
3. 確保放開關節時，骨架定格角度記錄在當前 `slot.customBoneRotations`。

- [ ] **Step 2: 修改 `src/renderer/vrm/PoseManager.js`**

1. 支援切換作用中人偶：當選中人偶改變時，重新讀取該人偶當前骨架角度並刷新面板。
2. 姿勢預設套用只影響 `avatarManager.getActiveVRM()`。
3. 新增 `syncCurrentPoseToAll()` 呼叫 `avatarManager.syncPoseToAll()`。

- [ ] **Step 3: 提交變更**
```bash
git add src/renderer/vrm/PuppetController.js src/renderer/vrm/PoseManager.js
git commit -m "feat(puppet): adapt PuppetController and PoseManager to target active avatar instance"
```

---

### Task 4: 升級 3D 射線點選（RaycastManager）與換裝面板（CostumeSelector）

**Files:**
- Modify: `src/renderer/core/RaycastManager.js`
- Modify: `src/renderer/ui/CostumeSelector.js`

**Interfaces:**
- Consumes:
  - `avatarManager: AvatarManager`
- Produces:
  - 點選人偶身體網格時自動呼叫 `avatarManager.selectAvatar(slotIndex)`。
  - 點擊換裝時為選中的人偶載入新外觀。

- [ ] **Step 1: 修改 `src/renderer/core/RaycastManager.js`**

檢測滑鼠點擊交會物體，判斷屬於哪一個人偶的 `vrm.scene`，觸發選取切換事件。

- [ ] **Step 2: 修改 `src/renderer/ui/CostumeSelector.js`**

換裝回呼改為針對選中的 slot 進行非同步換裝加載，並保留該人偶當前的站位與自定義姿勢。

- [ ] **Step 3: 提交變更**
```bash
git add src/renderer/core/RaycastManager.js src/renderer/ui/CostumeSelector.js
git commit -m "feat(interaction): support 3D raycast click selection and per-avatar costume switching"
```

---

### Task 5: 整合 app.js 入口與新增斜線指令

**Files:**
- Modify: `src/renderer/app.js`

**Interfaces:**
- Consumes:
  - `AvatarManager`, `MultiAvatarBar`, `PuppetController`, `PoseManager`
- Produces:
  - 應用程式啟動時由 `AvatarManager` 載入預設人偶。
  - 註冊斜線指令：
    - `/clone add [costume]`
    - `/clone remove`
    - `/clone list`
    - `/clone select <index>`
    - `/clone reset`
    - `/clone sync`

- [ ] **Step 1: 在 `src/renderer/app.js` 替換 AvatarController 為 AvatarManager 驅動**

1. 實例化 `AvatarManager` 並將其掛載至 `sceneManager` 更新循環。
2. 實例化 `MultiAvatarBar` 並掛載於 UI 頂部容器。
3. 連結 `puppetController`、`poseManager`、`costumeSelector`、`snapshotService`。
4. 擴充 `handleSlashCommand` 新增 `/clone` 完整指令集。

- [ ] **Step 2: 驗證無語法錯誤且各模組引用正確**

- [ ] **Step 3: 提交變更**
```bash
git add src/renderer/app.js
git commit -m "feat: integrate AvatarManager and MultiAvatarBar with slash commands in app.js"
```

---

### Task 6: 專案建置與整體成果審查 (Self-Review & Checkpoint)

**Files:**
- All modified files

- [ ] **Step 1: 規格全面覆蓋檢查 (Spec Coverage Check)**
對照 `docs/MULTI_AVATAR_CLONE_SPEC.md` 逐項確認所有 8 項驗收標準是否皆有對應實作。

- [ ] **Step 2: 提交整體成果至 Git**
```bash
git push origin feat/multi-avatar-clone
```
