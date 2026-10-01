# 筆電視訊鏡頭一鍵開關 AR 模式規格文件 (Laptop Webcam AR Mode Spec)

## 1. 需求背景與目標

使用者希望將目前的 3D 桌面 AI 女友擴充支援 **AR 模式（Augmented Reality）**，首要實現「**筆電/電腦視訊鏡頭一鍵開關 AR**」。

### 核心體驗目標：
1. **一鍵切換模式**：
   - 平時：維持原本的 Windows 桌面透明桌寵模式（Transparent Always-on-top），不阻擋桌面工作。
   - 點擊 AR：視窗底層立即無縫開啟筆電鏡頭畫面，房間、辦公桌直接成為真實背景，3D 女友如同打破次元壁來到真實空間。
   - 再次點擊：立即關閉相機視訊串流，熄滅鏡頭指示燈，釋放硬體資源，迅速回到透明桌面。
2. **視訊鏡像自拍感 (Mirror Mode)**：
   - 面對筆電鏡頭時，預設如同自拍鏡子般呈現（水平翻轉），視覺體驗最自然。提供一鍵切換正常/鏡像視角。
3. **多攝影機相容支援**：
   - 支援自動偵測本機鏡頭設備（如筆電內建鏡頭、USB 外接 WebCam、OBS Virtual Camera 等），可於設定中快速切換。
4. **AR 實景拍照同框 (AR Snapshot)**：
   - 完美結合既有的 3D 拍照功能，拍照時同時捕捉視訊背景與 3D 模型，一鍵拍下「我與女友在房間的拍立得合照」。

---

## 2. 系統架構與職責分配

```
src/
├── renderer/
│   ├── core/
│   │   ├── ARManager.js             # [新增] 負責 MediaDevices 鏡頭控制、視訊節點注入、串流管理與鏡像翻轉
│   │   ├── SceneManager.js          # [整合] AR 模式下光影強化、背景透明與畫布深度同步
│   │   └── SnapshotService.js       # [升級] 支援 AR 模式下合併 Video 視訊畫面與 Three.js Canvas 合成匯出
│   ├── ui/
│   │   ├── Toolbar.js               # [升級] 工具列新增「📷 AR」按鈕與呼吸燈開啟狀態提示
│   │   ├── SettingsModal.js         # [升級] 設定面板新增「視訊攝影機」選單與鏡像開關
│   │   └── ChatBox.js               # [升級] 支援斜線指令 `/ar on`、`/ar off`、`/ar toggle`
│   └── app.js                       # 模組生命週期串接與 AR 事件監聽
```

---

## 3. 詳細功能規格

### 3.1 視訊鏡頭管理器 (ARManager.js)
- **硬體調用**：
  ```javascript
  navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user'
    },
    audio: false
  });
  ```
- **視訊 DOM 結構**：
  在 `#canvas-container` 最底層（`z-index: 0`）注入隱形 `<video>` 容器：
  ```html
  <video id="arVideoFeed" autoplay playsinline muted class="absolute inset-0 w-full h-full object-cover hidden transition-opacity duration-500"></video>
  ```
  Three.js 的 `<canvas>` 則維持在 `z-index: 10` 上層，背景保持完全透明。
- **硬體資源釋放**：
  關閉 AR 模式時，必須完整調用 `stream.getTracks().forEach(track => track.stop())`，確保筆電相機指示燈立刻熄滅，兼顧隱私與節電。

### 3.2 工具列與互動狀態 (Toolbar.js)
- 工具列加入按鈕：`#btnAR`
  - 關閉狀態：`📷 AR`，灰色/微透明，未啟動相機。
  - 開啟狀態：`✨ AR`，高亮粉/青色微光（`ring-2 ring-emerald-400 bg-emerald-500/20`），提示使用者攝影機運作中。
- 當第一次啟動且鏡頭權限被拒或無鏡頭時，彈出友好提示對話框，不造成程式崩潰。

### 3.3 實景拍照同框 (SnapshotService.js 升級)
- 原先拍照僅截取 Three.js WebGL Canvas。
- 在 AR 模式啟用時：
  1. 建立離線 2D Canvas。
  2. 先繪製目前 `<video>` 當前幀畫面（若開啟鏡像則進行矩陣翻轉）。
  3. 再將 Three.js WebGL Canvas 疊加繪製於其上。
  4. 匯出高解析度 PNG，實現真實世界與 3D 女友的合照！

### 3.4 對話指令整合 (ChatBox.js)
- 支援對話框斜線指令：
  - `/ar` 或 `/ar toggle`：切換 AR 鏡頭開關
  - `/ar on`：開啟鏡頭
  - `/ar off`：關閉鏡頭
  - `/ar mirror`：切換鏡像翻轉

---

## 4. 安全與隱私保護機制
1. **免後端傳輸**：Webcam 視訊流完全停留在本機瀏覽器渲染管線（Local Renderer Process），絕不將未經授權的影像串流上傳至外部伺服器。
2. **即時指示**：工具列狀態與系統相機指示燈同步，離開或休眠時自動關閉視訊串流。
