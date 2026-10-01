# 鏡頭手勢偵測人偶拉扯互動規格文件 (Hand Tracking Puppet Interaction Spec)

## 1. 需求背景與目標

使用者希望在 AR/鏡頭模式下，能夠直接用真實的手指「像玩實體玩具一樣」去抓取、碰觸與拉扯 3D AI 女友的人偶肢體：
- **抓取手部**：捏合手指抓住女友的手腕，拉扯移動手部，手臂隨手指引導自然伸展。
- **抓取腳部**：抓住腳掌或小腿，拉扯移動腳步擺出各種動態姿勢。
- **摸頭/捏臉**：觸摸頭部觸發摸頭與害羞互動。
- **逼真力學與情感反饋**：拉扯時具備彈簧牽引視覺效果，並伴隨生動的語音台詞與表情互動。

---

## 2. 核心架構與互動流程

```
筆電鏡頭 (Webcam Feed)
       │
       ▼
[HandTracker.js] (MediaPipe Hands / 關鍵點計算)
       │  - 21 個手部 3D 骨架關節
       │  - 食指 (#8) 與拇指 (#4) 捏合偵測 (Pinch Detection)
       │  - 螢幕座標轉 Three.js 空間座標 (Raycasting & Depth Mapping)
       ▼
[PuppetController.js] (關節抓取與反向運動學 IK 運算)
       │  - 關節命中吸附 (Head, Left/Right Hand, Left/Right Foot)
       │  - 兩段式手臂/腿部關節導向 (Two-Bone IK Solver)
       │  - 姿態即時覆蓋 (Pose Override)
       ▼
[Emotion & Audio Feedback]
       │  - 拉扯手部：「哎呀～主人要帶我去哪裡呢？💕」
       │  - 抓腳懸空：「呀！主人快放人家下來啦～好害羞😣」
       │  - 摸頭互動：「嘻嘻，最喜歡主人摸摸頭了～😊」
       ▼
[Three.js VRM Model] (即時骨架關節渲染 + 牽引彈簧光效)
```

---

## 3. 詳細功能規格

### 3.1 手指辨識與捏合判定 (HandTracker.js)
- **手勢模型**：整合 Google MediaPipe Hands 輕量 WebAssembly 引擎，於本地瀏覽器端運行（每秒 30~60 FPS，免伺服器運算）。
- **捏合判定 (Pinch Threshold)**：
  - 計算拇指指尖（Landmark 4）與食指指尖（Landmark 8）的歐幾里得距離。
  - 距離 `< 0.05`（標準化視窗比例）：判定為 `isPinching = true`（抓住）。
  - 距離 `> 0.08`：判定為 `isPinching = false`（鬆手）。
- **虛擬游標與引力線**：
  - 在食指與拇指中點繪製「能量光圈」。
  - 未捏合時為青色小圓點；捏合時變為粉色抓取光芒，並拉出一條能量牽引線連接至被抓取的關節。

### 3.2 關節吸附與拉扯物理 (PuppetController.js)
- **支援抓取關節目標**：
  1. `rightHand` / `rightLowerArm`（右手）
  2. `leftHand` / `leftLowerArm`（左手）
  3. `rightFoot` / `rightLowerLeg`（右腳）
  4. `leftFoot` / `leftLowerLeg`（左腳）
  5. `head`（頭部摸頭）
- **吸附距離判定 (Snapping Radius)**：
  - 手指靠近人偶關節 3D 投影範圍 `< 40px` 時自動高亮並鎖定該關節。
- **反向運動學拉扯 (Two-Bone IK Calculation)**：
  - 當拉扯手掌時，自動計算上臂（UpperArm）與前臂（LowerArm）朝向手指目標點的旋轉角度，呈現如同被手臂牽拉的自然彎曲與延伸。
- **鬆手復原機制 (Release Behavior)**：
  - 提供兩種模式：
    - **維持擺姿 (Hold Pose)**：鬆開手指後，人偶維持拉扯完的造型。
    - **物理彈回 (Spring Rest)**：鬆手後以物理平滑彈簧動畫（Lerp / Spring damping）緩緩恢復自然待機姿勢。

### 3.3 情感與動作對話連鎖
- 觸發時機根據抓取部位與拉扯距離：
  - **摸頭**：觸發害羞表情、閉眼微笑、心動音效。
  - **輕拉手部**：微笑、身體微微傾斜朝向手指。
  - **大幅拉扯手/腳**：觸發驚訝表情、頭部看向被抓部位，語音台詞隨機播放：「哇！主人好調皮～」、「痛痛痛～要被主人拉成麵條啦！」。
