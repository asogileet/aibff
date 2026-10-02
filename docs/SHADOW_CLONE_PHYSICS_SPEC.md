# 桌面影分身自由擺放、個別縮放與全螢幕重力物理碰撞規格書

## 1. 需求背景與現狀分析

### 1.1 使用者期望之體驗
1. **影分身任意擺放**：不再侷限於同一水平排隊，可在桌面 3D 空間或螢幕畫面中的任意 X/Y/Z 位置擺放分身。
2. **個別縮放 (Per-Avatar Scaling)**：每個分身可獨立放大或縮小（例如本尊 1.0x 標準大小、分身為 0.5x 迷你 Q 版伴侶或 1.8x 巨型人偶）。
3. **全螢幕活動範圍與左右橫跨奔跑 (Screen Roaming)**：在全螢幕透明畫布下，角色可以在整個螢幕底端（如工作列上方）自主漫步、從左跑到右巡邏，增加生命力。
4. **抓起懸空、拋擲重力墜落與物理碰撞 (Pick-up, Gravity & Impact)**：
   - 滑鼠按住人偶可將其「提起到空中懸空」，手腳產生自然懸空晃動或驚慌掙扎姿態。
   - 放開滑鼠後受重力加速度下墜（支援甩動滑鼠進行慣性拋擲）。
   - 接觸地面（桌面底部）時產生彈力碰撞（Bounce）與擠壓緩衝（Squash & Stretch），過高掉落觸發跌倒/屁屁著地萌感動作，隨後拍拍衣服站起。

### 1.2 現狀對比
| 功能維度 | 目前版本現狀 | 目標升級版本 |
| :--- | :--- | :--- |
| **分身位置** | 固定排成一橫排（固定間距 0.72m） | 支援滑鼠 3D 射線平面拖曳，各自分布於桌面任意角落 |
| **分身縮放** | 全體固定為 1.0x 原始比例 | 每個分身獨立 `scale` (0.3x ~ 3.0x)，支援滾輪與 UI 滑桿調節 |
| **全螢幕活動** | 視窗變大，但人偶仍站在中央不動 | 支援全螢幕巡邏、奔跑橫跨螢幕、滑鼠引導移動 |
| **重力與碰撞** | 無物理模擬，角色固定在 y=0 地面 | 整合重力加速度、垂直下墜、彈性反彈與著地跌倒反饋 |
| **拖曳抓取** | 拖曳僅移動 Electron 小視窗 | 支援直接抓起人偶實體（懸空拎起姿態），支援慣性拋擲 |

---

## 2. 技術可行性分析（完全可行）

### 2.1 坐標系與 3D 平面投影 (Plane Raycasting)
- 目前 `RaycastManager.js` 已具備 Three.js `Raycaster`。
- 我們可以建立一個對齊相機的虛擬空間拖曳平面（Drag Plane）：
  ```javascript
  // 透過滑鼠光標投射至 Z=0 或人偶所在深度平面
  const intersection = new THREE.Vector3();
  raycaster.ray.intersectPlane(dragPlane, intersection);
  avatar.scene.position.copy(intersection);
  ```
- 當視窗為全螢幕時，整個螢幕都是互動區域，人偶可以在整個螢幕畫布的任意 X、Y、Z 座標移動。

### 2.2 個別縮放架構 (Per-Avatar Scale)
- `AvatarSlot` 結構增加 `scale = 1.0` 屬性。
- Three.js 的 `vrm.scene.scale.setScalar(slot.scale)` 能原生支援全骨骼與網格的等比縮放。
- `@pixiv/three-vrm` 的 SpringBone（頭髮、裙襬等物理骨骼）在模型縮放時會自然跟隨頂點空間，完全無相容性問題。

### 2.3 重力與運動物理學 (Physics Dynamics)
- 建立輕量且穩定的 `MascotPhysicsEngine`：
  - 重力加速度：$g = 9.8 \text{ m/s}^2$（可轉換為 3D 空間每秒下墜速度）
  - 終端地面判定：$y_{\text{ground}} = 0$（即視窗或螢幕底端）
  - 拋擲速度計算：在滑鼠拖曳過程中維護最近 3 幀的移動速度向量 $\vec{v} = \frac{\Delta \vec{p}}{\Delta t}$，放開滑鼠時直接將 $\vec{v}$ 注入人偶作為初速度。
  - 彈跳係數：$e \approx 0.35$（著地彈跳 1~2 次後靜止）。
  - 衝擊判定：若落地瞬間 $|v_y| > v_{\text{threshold}}$，觸發跌倒或蹲姿著地緩衝動畫。

### 2.4 抓起姿態與動畫狀態機 (States & Postures)
- 當人偶被滑鼠拎起時，切換至「懸空被拎起 (Dangling / Picked Up)」動作：
  - 雙臂自然略微向上抬起、雙腿微微晃動收縮。
  - 落地時恢復常態 Idle。

---

## 3. 架構實施規劃

1. **核心資料結構擴充 (`AvatarSlot`)**：
   - 擴充 `scale`, `velocity`, `physicsState` ('idle', 'held', 'falling', 'impact', 'patrol')。
2. **物理更新模組 (`MascotPhysicsController`)**：
   - 每幀在 `render loop` 中計算重力、速度積分、地面碰撞與反彈。
3. **互動系統升級 (`RaycastManager.js`)**：
   - 在全螢幕或視窗模式下，支援直接左鍵選取並拖曳人偶實體。
   - 支援滾輪針對游標下的人偶調整大小。
4. **UI 與工具列整合 (`MultiAvatarBar.js` / `Toolbar.js`)**：
   - 在多角色分身選單中增加「縮放比例滑桿 (Scale)」與「位置重置」按鈕。
   - 快捷指令新增：`/scale <0.5~2.0>`, `/patrol`, `/drop` 等。

---

## 4. 驗證與 Mockup

已建立獨立互動原型：
- 檔案路徑：[mockup_shadow_clone_physics.html](file:///c:/github/aibff/docs/mockup_shadow_clone_physics.html)
- 具備：任意拖放、滑鼠滾輪縮放、懸空晃動、自由落體、高速摔倒判定、螢幕底端左右橫跨奔跑。
