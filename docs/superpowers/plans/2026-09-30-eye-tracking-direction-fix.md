# 眼睛視線與頭部追蹤同向修復 實作計畫 (Implementation Plan)

## 1. 問題概述 (Overview)
- **問題現象**：使用者在移動滑鼠時，3D 模型的眼睛視線以及頭部並非朝向滑鼠游標所在方向，而是完全朝相反方向注視與偏轉（滑鼠往右，角色看左；滑鼠往左，角色看右；滑鼠往上時頭部呈現低頭而非抬頭）。
- **影響範圍**：[`src/renderer/vrm/EyeTrackingController.js`](file:///C:/github/aibff/src/renderer/vrm/EyeTrackingController.js)

---

## 2. 根因分析 (Root Cause Analysis)

1. **水平注視點 World Coordinate 計算反向**：
   - 在 `EyeTrackingController.js` 第 31-32 行：
     ```javascript
     // Invert targetX because AliciaSolid faces camera with Math.PI rotation
     const targetX = THREE.MathUtils.clamp(-this.mouse.x * 0.8, -Math.sin(this.MAX_YAW), Math.sin(this.MAX_YAW));
     ```
   - 原程式碼誤以為「因為角色模型本身在世界坐標系中旋轉了 180 度（$\pi$）朝向鏡頭，所以目標點的世界坐標 X 需要取負號 `-this.mouse.x`」。
   - **實情**：傳入 `@pixiv/three-vrm` 的 `vrm.lookAt.lookAt(target)` 接收的是**世界空間坐標（World Space Position）**。`VRMLookAt` 內部會自動將世界坐標轉換為模型的頭部局部空間（透過矩陣逆轉換）。
   - 當滑鼠在畫面右側（`mouse.x > 0`）時，世界坐標系下相機看過去的右側也是 $+X$。原程式碼加上了負號，使得目標點被設置在螢幕左側（$-X$），造成眼球反方向注視。

2. **頭部水平偏轉 (Yaw) 與俯仰 (Pitch) 符號相反**：
   - 第 49-50 行：
     ```javascript
     const yaw = THREE.MathUtils.clamp(-this.mouse.x * 0.35, -this.MAX_YAW, this.MAX_YAW);
     const pitch = THREE.MathUtils.clamp(this.mouse.y * 0.25, -this.MAX_PITCH, this.MAX_PITCH);
     ```
   - **Yaw 符號**：加了負號 `-this.mouse.x * 0.35`，使得滑鼠在右邊時頭部向左轉。
   - **Pitch 符號**：Three.js 骨骼局部旋轉中，`rotation.x > 0` 為向前屈曲（低頭），`rotation.x < 0` 為向後伸展（抬頭）。當滑鼠往上方移動（`mouse.y > 0`）時，原本將正的 `pitch` 賦給 `rotation.x`，導致角色做出低頭動作，與向上看產生違和與衝突。

---

## 3. 預計修改項目與程式碼變更 (Proposed Changes)

### 檔案：[`src/renderer/vrm/EyeTrackingController.js`](file:///C:/github/aibff/src/renderer/vrm/EyeTrackingController.js)

1. **修正注視點世界座標 `targetX`**：
   - 移除負號，使世界坐標目標點與滑鼠螢幕位置保持同向：
   ```javascript
   // Target look-at in world space aligns directly with screen mouse coordinates
   const targetX = THREE.MathUtils.clamp(this.mouse.x * 0.8, -Math.sin(this.MAX_YAW), Math.sin(this.MAX_YAW));
   const targetY = 1.35 + THREE.MathUtils.clamp(this.mouse.y * 0.5, -Math.sin(this.MAX_PITCH), Math.sin(this.MAX_PITCH));
   this.targetLookAtPos.set(targetX, targetY, 1.2);
   ```

2. **修正頭部與頸部骨骼 Yaw / Pitch 轉向**：
   - `yaw` 改為正向（`this.mouse.x * 0.35`）：滑鼠在右時頭部自然轉向右側。
   - `pitch` 取負號（`-this.mouse.y * 0.25`）：滑鼠在上方時頭部自然微微抬起，滑鼠在下方時微微低頭。
   ```javascript
   // Yaw and pitch for head orientation (negative pitch for looking upward)
   const yaw = THREE.MathUtils.clamp(this.mouse.x * 0.35, -this.MAX_YAW, this.MAX_YAW);
   const pitch = THREE.MathUtils.clamp(-this.mouse.y * 0.25, -this.MAX_PITCH, this.MAX_PITCH);
   ```

---

## 4. 驗證與比對指標 (Verification Matrix)

| 滑鼠動作 | 原始錯誤行為 | 修復後預期行為 |
| :--- | :--- | :--- |
| 滑鼠移至螢幕右側 | 眼睛向左看、頭部向左偏轉 ❌ | 眼睛注視滑鼠右側、頭部向右轉動 ✅ |
| 滑鼠移至螢幕左側 | 眼睛向右看、頭部向右偏轉 ❌ | 眼睛注視滑鼠左側、頭部向左轉動 ✅ |
| 滑鼠移至螢幕上方 | 眼睛向上但頭部向下點 ❌ | 眼睛注視上方、頭部自然微抬起 ✅ |
| 滑鼠移至螢幕下方 | 眼睛向下但頭部向上仰 ❌ | 眼睛注視下方、頭部自然微低頭 ✅ |

---

## 5. 授權與確認步驟 (Next Steps)
- 依據開發規範，已產出 HTML Mockup [`mockup/eye_tracking_fix_mockup.html`](file:///C:/github/aibff/mockup/eye_tracking_fix_mockup.html)。
- 本計畫提出後，待使用者明確回覆**「同意」**後，方進行檔案修改。
- 修改後遵循嚴格測試限制規範，主動詢問使用者授權，不擅自啟動應用程式測試。
