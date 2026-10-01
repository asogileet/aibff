# 影分身多角色同台與各別姿勢調整規格書 (MULTI_AVATAR_CLONE_SPEC)

## 1. 需求背景與目標 (Background & Objectives)

### 1.1 背景
目前桌面 AI 女友應用程式在 3D 場景中僅支援單一活動之 VRM 角色實例（透過 `AvatarController` 加載）。使用者希望能夠施展「**影分身之術**」，在透明桌面或 AR 畫布上同時召喚出多個人偶，並能各自獨立換裝（例如：主身穿著休閒服，分身同時同台百鬼綾目、薄荷泳裝或水手制服），且能夠自由排布站位、拉扯捏出各別的肢體動作與姿勢預設。

### 1.2 目標
1. **多 VRM 實例管理 (AvatarManager)**：支援在同一 Three.js Scene 中同時存在 1 ~ 4 個獨立的 VRM 人偶實例。
2. **直覺切換選取 (Active Target Routing)**：
   - 滑鼠或手指在 3D 場景中點擊任一人偶網格或關節即自動切換為選中對象。
   - 選中之人偶腳底顯示發光高亮光圈（Selection Ring），讓使用者一眼辨識當前控制主體。
   - UI 頂部提供分身導覽列（`[人偶 ① 主身] [人偶 ② 分身] [+ 召喚影分身] [✕ 移除分身]`）。
3. **各別站位搬移 (Independent Hips Repositioning)**：
   - 進入玩偶捏人模式（Puppet Mode）時，按住選中人偶的腰部/臀部（hips）拖曳，可直接在 3D 空間中調整其 X/Z 站位座標，達成並排、前後錯落或合影站姿。
4. **獨立姿勢捏人 (Independent Pose & Puppet)**：
   - 針對當前選中人偶拉扯手、腳、頭部、脊椎關節，放開後自動定格保持塑形姿勢。
   - 姿勢庫（`PoseModal`）與預設動作（可愛剪刀手、自信插腰、貓耳喵喵手等）可單獨套用至當前選中人偶。
   - 提供「姿勢同步至全員」按鈕，快速讓全體分身擺出整齊劃一的舞蹈或儀隊隊形。
5. **獨立外觀換裝 (Independent Costumes)**：
   - 點擊換裝（CostumeSelector）僅改變當前選取人偶的外觀，實現不同服裝與角色同台共演。

---

## 2. 系統架構設計 (Architecture Design)

### 2.1 模組關係架構圖 (C4 Container Diagram)

```
+------------------------------------------------------------------------+
|                            Three.js Scene                              |
|                                                                        |
|   +-----------------------+              +-------------------------+   |
|   |   Avatar Slot 0 (主身) |              |   Avatar Slot 1 (分身)   |   |
|   |  - VRM (Alicia/Ayame) |              |  - VRM (Mint/School)    |   |
|   |  - Position: (-0.6,0) |              |  - Position: (+0.6,0)   |   |
|   |  - Poses / Bone Rots  |              |  - Poses / Bone Rots    |   |
|   +-----------------------+              +-------------------------+   |
|               ▲                                      ▲                 |
+---------------|--------------------------------------|-----------------+
                |                                      |
       +--------------------------------------------------------+
       |                     AvatarManager                      |
       |  - slots: [AvatarSlot, AvatarSlot, ...]                |
       |  - activeIndex: 0                                      |
       |  - groundSelectionRing: Mesh (follows active avatar)   |
       |  - spawnClone(costumeKey, offsetPos)                   |
       |  - removeClone(slotIndex)                              |
       +--------------------------------------------------------+
                ▲                                      ▲
                | (Active Avatar Proxy)                | (Active Avatar Proxy)
       +------------------+                   +------------------+
       | PuppetController |                   |   PoseManager    |
       | (肢體拉扯物理捏人)|                   | (骨架角度與預設庫)|
       +------------------+                   +------------------+
                ▲                                      ▲
                |                                      |
       +--------------------------------------------------------+
       |               MultiAvatarBar & Toolbar UI              |
       |  [人偶 ①] [人偶 ②] [+ 影分身] [✕ 移除] [站位重排]       |
       +--------------------------------------------------------+
```

### 2.2 核心資料結構 (AvatarSlot)

```javascript
// AvatarSlot 資料模型
export class AvatarSlot {
  constructor(id, title, vrm, costumeKey = 'casual', position = new THREE.Vector3()) {
    this.id = id;                     // 唯一識別碼，如 'avatar_slot_0'
    this.title = title;               // 顯示名稱，如 '人偶 ① (主身)'
    this.vrm = vrm;                   // @pixiv/three-vrm 實例
    this.costumeKey = costumeKey;     // 當前服裝代碼 ('casual', 'school', 'ayame', 'mint' 等)
    this.position = position;         // 3D 世界站位偏移量
    this.customBoneRotations = {};    // 保持之捏人骨架旋轉角度
    this.isSculpted = false;          // 是否處於手動雕刻定格狀態
  }
}
```

### 2.3 3D 射線選取與光圈追蹤 (Raycast & Selection Ring)
1. **Raycasting 檢測**：
   - 當使用者在畫布上進行 `pointerdown` 時，`RaycastManager` 射線與各個 Avatar 實例的 Humanoid Bone 網格或 Bounding Box 進行碰撞檢測。
   - 碰撞到任一人偶時，自動將 `AvatarManager.activeIndex` 切換為該人偶的 slot index。
2. **腳底光圈視覺反饋 (Ground Selection Ring)**：
   - 場景中維護一個半透明發光圓環（帶有緩動呼吸發光材質，顏色為 `#38bdf8` 天藍色）。
   - 當切換選中人偶時，光圈平滑移動至該人偶腳底（X, Y: 0.005, Z 座標），清楚標示控制焦點。

### 2.4 PuppetController 與 PoseManager 轉接
- `PuppetController` 與 `PoseManager` 原先直接操作 `avatarController.currentVRM`。
- 重構後，兩者透過代理 getter `avatarManager.getActiveVRM()` 取得當前作用中人偶。
- 在 `PuppetController.updateHips(screenDelta)` 中：
  - 改為直接修改當前選中人偶的 `vrm.scene.position.x` 與 `vrm.scene.position.z`，實現平滑的世界座標站位拖曳。
- 在切換選中對象時，`PoseManager` 自動將當前面板滑桿數值刷新為該選中人偶的骨架旋轉值。

---

## 3. UI 與操作介面規格 (UI & UX Specification)

### 3.1 頂部/工具列分身管理列 (`PuppetPoseBar` / `MultiAvatarBar`)
在畫面上方（與姿勢工具列整合或平行排列）：
- **分身標籤按鈕**：
  - `人偶 ① (主身)`：高亮表示選中，旁邊顯示顏色圓點。
  - `人偶 ② (分身)`：點選立即切換選取。
- **功能按鈕**：
  - `✨ 召喚影分身`：新增一個人偶實例（最多 4 人），自動站位於右側或左側空位。
  - `✕ 移除選取`：刪除當前選中之人偶（主身不可刪除，至少保留 1 人）。
  - `📐 重整站位`：自動將目前所有人偶均勻水平分散排列於鏡頭前。
  - `📋 姿勢同步全員`：將當前選中人偶的骨架角度一次性套用給所有人偶。

### 3.2 換裝面板 (`CostumeSelector`) 連動
- 打開換裝面板並點擊任何一套衣服（如：百鬼綾目、薄荷、哥德蘿莉）時，**僅替換當前選中的人偶**。
- 支援同一畫面出現不同角色的豪華陣容（例如：Alicia + 百鬼綾目 + 薄荷泳裝同框合照）。

### 3.3 斜線指令支援 (Slash Commands)
- `/clone add [costume]`：召喚新分身（可選指定服裝）。
- `/clone remove`：刪除當前選中之人偶。
- `/clone list`：列出場景中所有人偶資訊與當前選中目標。
- `/clone select <index>`：切換選中人偶（如 `/clone select 1`）。
- `/clone reset`：重置所有人偶的站位。

---

## 4. 效能最佳化與資源防護 (Performance & Safety)

1. **分身數量上限**：
   - 桌面透明視窗硬體加速考量，設定上限為 **4 個人偶**。達到上限時，`+ 召喚影分身` 按鈕變為 disabled 並提示「已達最大分身上限 (4 人)」。
2. **記憶體釋放 (Garbage Collection)**：
   - 當移除分身時，執行 `scene.remove(slot.vrm.scene)` 並呼叫 `VRMUtils.deepDispose(slot.vrm.scene)`，徹底釋放幾何體與貼圖快取，防止 GPU VRAM 洩漏。
3. **渲染更新迴圈 (Render Loop)**：
   - `sceneManager.update()` 遍歷呼叫所有 `slot.vrm.update(delta)`，確保非選中的人偶依然保有自然微弱呼吸與頭髮布料物理晃動（SpringBone）。

---

## 5. 驗證與驗收標準 (Verification Criteria)

| 序號 | 驗收項目 | 預期結果 |
|---|---|---|
| 1 | 召喚分身 | 點擊「召喚影分身」後，場景中正確新增第 2 個人偶並以自然站姿呈現，不卡頓 |
| 2 | 3D 點擊選取 | 點擊任一人偶的身體或關節，光圈平滑移至其腳底，UI 標籤同步切換為該人偶 |
| 3 | 獨立站位位移 | 在玩偶模式下拉扯選中人偶的腰部/臀部，該人偶可在場景中平滑左右移動，其他人偶不受影響 |
| 4 | 獨立關節捏人 | 拉扯選中人偶的手臂或腳踝，僅該人偶擺出對應姿勢並在放開後定格保持 |
| 5 | 各別換裝 | 選中人偶 ② 並切換為「百鬼綾目」，人偶 ① 依然維持原先服裝 |
| 6 | 姿勢庫套用 | 選擇姿勢預設（如「可愛剪刀手」），僅套用至當前選中人偶 |
| 7 | 刪除分身 | 點擊移除選取後，該分身從場景中移除，記憶體正常釋放，控制焦點自動切換至前一人偶 |
| 8 | 拍照與全螢幕 | 執行截圖拍照（`/photo`），畫面中完整捕捉多個人偶同框與自定義動作 |
