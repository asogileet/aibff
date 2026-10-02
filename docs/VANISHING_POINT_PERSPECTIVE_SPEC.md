# 3D 消失點與立體透視控制 (Vanishing Point & Perspective) 規格文件

## 1. 需求背景與目標
目前桌面 AI 女友應用程式採用 Three.js `PerspectiveCamera`，預設視角固定為 $30^\circ$ 且光學中心固定於視窗正中央 $(0, 0)$。
雖然具備相機高度 (Pan Y) 與環繞軌道 (Orbit) 調整，但對於追求強烈立體感、動漫張力仰角、或透視景深（近大遠小）的使用者而言，缺乏：
1. **動態視角 (FOV) 調節**：無法自由在「望遠公仔平坦感 ($15^\circ \sim 25^\circ$)」與「廣角魄力立體感 ($50^\circ \sim 75^\circ$)」之間切換。
2. **消失點位移 (Vanishing Point Shift / Off-Axis Projection)**：無法移動畫面中的透視收斂點。例如在仰角看桌面人偶時，希望消失點落在頭頂或地面，使兩側線條產生強烈往消失點收聚的立體透視，同時垂直線不變形。
3. **空間立體參考網格 (Spatial Ground Grid & Horizon)**：透明桌面背景下缺乏空間座標參考，若有立體透視地板網格或輔助線，能大幅增強空間感與深度。

---

## 2. 核心架構與技術原理

### 2.1 Three.js 消失點位移 (Off-Axis Projection)
在 Three.js 中，相機的消失點（投影中心）可透過 `camera.setViewOffset()` 進行無損位移：
```javascript
// fullWidth, fullHeight: 視窗全寬高
// xOffset, yOffset: 光軸偏移量 (由歸一化 -1.0 ~ +1.0 換算)
// width, height: 渲染區域寬高 (等於 fullWidth, fullHeight)
camera.setViewOffset(fullWidth, fullHeight, xOffset, yOffset, fullWidth, fullHeight);
camera.updateProjectionMatrix();
```
當 `xOffset = 0, yOffset = 0` 時為標準對稱透視；當 `yOffset` 向下偏移時，消失點向上聚攏，形成極強的仰視立體收斂感。

### 2.2 動態 FOV (透視張力)
```javascript
camera.fov = targetFov; // 15度 (望遠/平面) ~ 85度 (極致動態廣角)
camera.updateProjectionMatrix();
```
- **公仔望遠 (20°)**：無透視畸變，展示角色全身輪廓。
- **標準自然 (30°~35°)**：目前的預設日常對話感。
- **動漫廣角 (60°~65°)**：近大遠小極為強烈，手臂、近景肢體具備極大立體衝擊力。

### 2.3 空間透視參考網格 (Ground Grid Helper)
- 在場景地板原點 $(0, 0, 0)$ 建立 `THREE.GridHelper(10, 20, 0xf43f5e, 0x334155)`。
- 支援浪漫粉光 (`#f43f5e`)、賽博冷青 (`#06b6d4`) 與簡約白。
- 可於設定面板一鍵顯示/隱藏，或透明漸層消散。

### 2.4 消失點十字準星與輔助線 (Vanishing Point HUD)
- 於 3D 畫布上疊加輕量級 SVG / Canvas 輔助射線，從視窗四角連至消失點。
- 支援於設定模式下「按住快捷鍵直接拖曳十字準星」來直覺調整消失點位置。

---

## 3. UI 與互動設計
1. **系統設定面板 (`SettingsModal.js`)**：
   - 新增 `📐 3D 透視與消失點` 分區。
   - 包含：
     - **視野廣角 (FOV)** 滑桿 ($15^\circ \sim 85^\circ$)。
     - **消失點水平偏移 (VP X)** 滑桿 ($-1.0 \sim +1.0$)。
     - **消失點垂直高度 (VP Y)** 滑桿 ($-1.0 \sim +1.0$)。
     - **風格預設集按鈕**：自然平視、動漫廣角、公仔望遠、張力極致仰視。
     - **3D 地面透視網格開關** 與色系切換。
     - **透視射線 / 消失點準星開關**。
2. **設定持久化 (`config.json`)**：
   - 保存 `cameraPerspective` 物件：
     ```json
     {
       "fov": 35,
       "vpOffsetX": 0.0,
       "vpOffsetY": 0.0,
       "showGrid": false,
       "gridStyle": "pink",
       "showGuides": false
     }
     ```

---

## 4. 原型成果
互動式 HTML Mockup 已產出於：
`mockup/vanishing_point_perspective_mockup.html`
支援完整的動態準星拖曳、即時透視變形預覽、預設集切換與風格切換。
