# 自由鏡頭視角、骨架關節微調、自訂姿勢快捷指令與 3D 拍照規格文件

## 1. 需求背景與目標

使用者提出以下四大核心需求：
1. **鏡頭任意視角與自由縮放**：
   - 上下平移 (Pan) 與仰俯角 (Phi) 需能完全涵蓋從頭頂（由上往下俯視）到腳底（由下往上仰視鞋底與足部）。
   - 遠近縮放 (Distance / Zoom) 擺脫原先只能縮放到固定範圍（0.75m ~ 4.2m）的限制，允許超近微距特寫（0.15m 臉部/眼部）到超遠廣角（10m+ 全景）。
   - 手機手勢操作全面支援：單指旋轉 (Orbit)、雙指捏合縮放 (Pinch-to-zoom)、雙指垂直拖曳平移 (Two-finger pan 調整高度到頭頂或腳底)。
2. **骨架主要關節清單列出與姿態調整 (Pose Editor / Skeleton Inspector)**：
   - 完整列出 VRM 模型主要骨骼關節：頭部 (Head)、頸部 (Neck)、左/右上臂 (UpperArm)、左/右前臂 (LowerArm)、左/右手掌 (Hand)、脊椎 (Spine)、骨盆重心 (Hips)、左/右大腿 (UpperLeg)、左/右小腿 (LowerLeg)、左/右腳掌 (Foot)。
   - 提供 3 軸 (X: Pitch, Y: Yaw, Z: Roll) 角度滑桿控制與即時旋轉預覽。
3. **自訂姿勢儲存、快捷鍵與斜線指令 (Custom Pose Shortcuts & Slash Commands)**：
   - 調整完成後可自訂名稱儲存至本機快顯儲存空間 (LocalStorage)。
   - 提供快捷按鈕隨時一鍵擺出該姿勢。
   - 整合對話斜線指令（例如：`/pose <名稱>`、`/pose list`、`/pose reset`）。
4. **一鍵 3D 拍照 (Snapshot / Photo Capture)**：
   - 工具列新增「📸 拍照」按鈕。
   - 支援將 Three.js Canvas 匯出為高畫質 PNG，支援保留背景或透明去背純角色匯出。
   - 快門視覺動畫反饋與自動下載存檔。

---

## 2. 系統架構與職責分配

```
src/
├── renderer/
│   ├── core/
│   │   ├── SceneManager.js          # [升級] 解除鏡頭仰俯角與距離限制，支援雙指 Pan 平移高度與極近/極遠縮放
│   │   └── SnapshotService.js       # [新增] 負責 Canvas 拍照、去背裁切、閃光動畫與下載
│   ├── vrm/
│   │   ├── AvatarController.js      # 提供 Humanoid 骨骼節點查詢與層級存取
│   │   ├── AnimationController.js   # [升級] 支援自訂姿勢覆蓋模式 (Pose Override Mode)，暫停/融合待機動作
│   │   └── PoseManager.js           # [新增] 管理所有骨架關節旋轉、姿勢儲存/載入、LocalStorage 同步
│   ├── ui/
│   │   ├── PoseModal.js             # [新增] 骨架關節檢視與姿態調整面板 (關節樹狀選單、三軸滑桿、儲存快捷鍵)
│   │   ├── Toolbar.js               # [升級] 加入「🦴 骨架/姿勢」與「📸 拍照」按鈕
│   │   └── ChatBox.js               # [升級] 攔截 `/pose`、`/photo` 等斜線指令直接調用對應模組
│   └── app.js                       # 串接 PoseManager、PoseModal、SnapshotService 與事件分發
```

---

## 3. 詳細功能規格

### 3.1 鏡頭控制 (SceneManager.js)
- **距離範圍**：`minDist = 0.15` (微距特寫)，`maxDist = 12.0` (超遠景)。
- **高度平移 (Target Y)**：範圍 `0.0m` (腳底/地面) 到 `1.8m` (頭頂與上方)，可由雙指滑動或控制項自由調整。
- **仰俯角 (Phi)**：放寬至 `-1.45` 到 `+1.45` 弧度（約 -83° ~ +83°），可直視頭頂或鞋底。
- **手機手勢支援**：
  - 1 指觸摸移動：`orbitTheta` 水平繞角色旋轉，`orbitPhi` 垂直仰俯。
  - 2 指捏合/張開：動態縮放距離 `targetCameraDist`。
  - 2 指垂直同步拖曳：動態調整 `cameraTarget.y`，輕鬆查看頭頂或腳底。

### 3.2 骨架關節控制與姿勢管理 (PoseManager.js & AnimationController.js)
- **支援關節清單**：
  - 頭頸部：`head`, `neck`
  - 上肢關節：`leftUpperArm`, `rightUpperArm`, `leftLowerArm`, `rightLowerArm`, `leftHand`, `rightHand`
  - 軀幹/重心：`spine`, `chest`, `hips`
  - 下肢關節：`leftUpperLeg`, `rightUpperLeg`, `leftLowerLeg`, `rightLowerLeg`, `leftFoot`, `rightFoot`
- **姿態覆蓋 (Pose Override)**：當使用者套用自訂姿勢時，鎖定關節旋轉，避免待機呼吸動畫將調整好的姿態還原，並提供「恢復待機 (Reset)」按鈕。
- **儲存格式**：
  ```json
  {
    "id": "pose_1700000000",
    "name": "剪刀手",
    "joints": {
      "rightUpperArm": { "x": -0.52, "y": 0.35, "z": -1.4 },
      "rightLowerArm": { "x": -1.4, "y": 0.26, "z": 0.0 },
      "rightHand": { "x": 0.0, "y": 0.0, "z": 0.35 },
      "head": { "x": 0.08, "y": -0.17, "z": 0.21 }
    }
  }
  ```

### 3.3 斜線指令 (ChatBox.js)
- `/pose <名稱>`：立即套用指定姿勢（模糊匹配自訂名稱）。
- `/pose list`：列出所有目前已儲存的自訂姿勢名稱與 ID。
- `/pose reset`：還原標準自然待機動作。
- `/photo` 或 `/snapshot`：立即觸發快門拍照。

### 3.4 拍照功能 (SnapshotService.js)
- 呼叫 `renderer.render(scene, camera)`。
- 透過 `canvas.toDataURL('image/png')` 產生高畫質 PNG。
- 自動建立虛擬 `<a>` 標籤並觸發瀏覽器下載：`aibff_snapshot_YYYYMMDD_HHMMSS.png`。
- 畫面上播放 0.3s 快門白色閃光動畫與提示氣泡。
