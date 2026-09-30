# 3D 桌面 AI 女友應用程式需求分析與系統架構規格書

## 1. 系統願景與核心指標

本系統旨在打造一款真正長期駐留在 Windows 11 桌面環境中的即時 3D 虛擬伴侶。具備透明無邊框浮動視窗、滑鼠眼神跟隨、摸頭互動反饋、Web Audio 即時頻譜口型同步（Lip Sync）、自然呼吸與眨眼、換裝特效、離場休息與快捷召回、本地 Ollama LLM 結構化意圖解析、以及基於 Faster-Whisper (CUDA float16) + Edge-TTS 的低延遲對話閉環。

### 硬體與運行環境目標
* 作業系統：Windows 11 64-bit
* GPU / 運算：NVIDIA RTX 4060 (8GB VRAM) / CUDA 加速
* 記憶體：32GB RAM
* 前端容器：Electron 34 + Three.js r174 + @pixiv/three-vrm 3.3
* 本地 AI 服務：Ollama (預設 `qwen3.8:27b`，端點 `http://127.0.0.1:11434`)
* 本地語音辨識服務：Python 3.13 + Faster-Whisper (float16 + Silero VAD)
* 語音合成：Edge-TTS 模組化設計 (支援微軟曉曉、曉伊、雲健等)

---

## 2. 系統架構模組設計

```
+---------------------------------------------------------------------------------+
|                                 Windows 11 Desktop                              |
+---------------------------------------------------------------------------------+
                                      |
       +------------------------------+------------------------------+
       |                                                             |
+------v-----------------------------+              +----------------v------------------+
|   Electron 34 透明無邊框主應用程式     |              |    Python 3 語音與 AI 服務後端    |
|   (Main Process & Preload IPC)     |              |    (FastAPI / WebSocket Local)    |
+------------------------------------+              +-----------------------------------+
       |                                                             |
       | IPC (window move, tray, hotkey)                             | Faster-Whisper CUDA
       v                                                             | Edge-TTS Stream
+------------------------------------+                               |
|   Three.js 3D 渲染與互動系統 (Renderer) <--------------------------+
+------------------------------------+
       |
       +---> AvatarController (VRM 3.3 加載與姿態管理)
       +---> AnimationController (呼吸、眨眼、揮手、待機動作融合)
       +---> EmotionController (happy, shy, caring, angry 表情 BlendShape)
       +---> ActionController (LLM 結構化 JSON 意圖調度器)
       +---> LipSyncController (Web Audio FFT 頻譜分析 -> aa, ih, ou, ee, oh)
       +---> EyeTrackingController (滑鼠平滑跟隨、脖子與視線限角防扭曲)
       +---> UIManager (半透明工具列、文字聊天框、換裝浮動面板、設定彈窗)
       +---> DesktopWidgetManager (離開時粉紅呼吸愛心掛件與多途徑召回)
```

---

## 3. 核心模組規格說明

### 3.1 桌面透明與交互 (Electron Main & Renderer)
* **視窗屬性**：`transparent: true`, `frame: false`, `alwaysOnTop: true`, `hasShadow: false`, `skipTaskbar: false`。
* **拖曳與點擊分離**：
  * 滑鼠按下頭部/身體時記錄起始點 `(startX, startY)`。
  * 若移動距離大於 5px 則進入視窗拖曳狀態（呼叫 IPC `desktop:move-window`）。
  * 若按下後未位移且小於 300ms 釋放，且點擊於頭部碰撞體範圍，觸發「摸摸頭 (Head Pat)」事件。
* **全域快捷鍵與托盤**：
  * 註冊 `Ctrl + Alt + G` 全域快捷鍵，任何狀態下快速召喚/切換前景。
  * 系統托盤駐留愛心圖示，提供右鍵選單：喚醒、換裝、休息、設定、結束程式。

### 3.2 3D VRM 角色狀態機 (Character Controller)
* **模型套裝**：
  * `costume_casual.vrm` (日常)
  * `costume_school.vrm` (水手服)
  * `costume_stylish.vrm` (時尚洋裝)
  * `costume_gothic.vrm` (哥德風)
  * `costume_seed.vrm` (未來科技)
* **換裝動畫演出**：旋轉 360 度骨骼補間動畫 + Three.js 星光/粉紅愛心粒子迸發特效 + 換裝成功語音反饋。
* **眼神與頭部跟隨**：
  * 透過全域螢幕或視窗滑鼠座標計算 LookAt 向量。
  * 使用 `Quaternion.slerp` 與 `MathUtils.damp` 實現平滑跟隨。
  * 限制旋轉範圍：頭部水平角度限制在 $\pm 35^\circ$，俯仰限制在 $\pm 20^\circ$。

### 3.3 即時音訊頻譜口型同步 (Web Audio API Lip Sync)
* **原理**：
  * 建立 `AudioContext` 與 `AnalyserNode`（FFT Size: 1024）。
  * 劃分 5 個代表性頻段：
    * 低頻 (200~500Hz) $\rightarrow$ `aa` (元音 A)
    * 中低頻 (500~1000Hz) $\rightarrow$ `oh` (元音 O)
    * 中頻 (1000~2000Hz) $\rightarrow$ `ou` (元音 U)
    * 中高頻 (2000~3500Hz) $\rightarrow$ `ee` (元音 E)
    * 高頻 (3500~6000Hz) $\rightarrow$ `ih` (元音 I)
  * 計算 RMS 能量並設定動態門檻，驅動 VRM 3.3 ExpressionManager 對應 BlendShape 權重，說話停止時平滑歸零。

### 3.4 本地語音辨識與 VAD (Faster-Whisper CUDA)
* Python 後端架設於本地 `http://127.0.0.1:8765`。
* 採用 `faster-whisper`，指定 `device="cuda"`, `compute_type="float16"`。
* 整合 Silero VAD（語音活動檢測）：
  * 靜音超時門檻：500ms 即斷句並觸發 STT 推理。
  * 自動去除背景噪音與幻覺文本。

### 3.5 模組化語音合成 (TTS Engine)
* 預設支援 `Edge-TTS`（音色：`zh-CN-XiaoxiaoNeural`, `zh-CN-XiaoyiNeural`, `zh-CN-YunjianNeural`）。
* 提供標準化介面 `ITTSProvider`，未來無縫抽換為 Azure TTS、OpenAI TTS 或本地 GPT-SoVITS 等。

### 3.6 LLM 結構化意圖協議 (Intent Action Dispatcher)
* System Prompt 強制規範輸出規格化 JSON：
```json
{
  "reply": "辛苦啦，今天是不是又忙了一整天？要不要先休息一下，我陪你聊聊。",
  "emotion": "caring",
  "action": "comfort",
  "costume": null
}
```
* ActionDispatcher 支援動作映射：`idle`, `leave`, `return`, `change_costume`, `wave`, `happy`, `shy`, `angry`, `surprised`, `comfort`, `head_pat`。

### 3.7 「離開 / 休息」與「召回」
* 使用者發出離開意圖時，播放揮手告別、角色淡出並縮小視窗為桌面右下角呼吸愛心掛件（Pink Pulsing Heart Widget）。
* 愛心掛件具備懸浮互動、滑鼠懸停光暈效果。
* 召回途徑：
  1. 點擊愛心掛件
  2. 快捷鍵 `Ctrl + Alt + G`
  3. 系統托盤選單點選「喚醒」
  4. 語音關鍵字監聽「回來」、「出來」、「我想你了」
* 召回演出：愛心隱藏，角色自螢幕邊緣滑入並揮手說「我回來啦！」。

### 3.8 一鍵啟動批次腳本 (`啟動AI女友.bat`)
* 自動偵測本機是否安裝並啟動 Ollama，若未運行則背景喚起。
* 檢查指定模型（如 `qwen3.8:27b`）是否存在，若無提示使用者 `ollama pull`。
* 啟動 Python Faster-Whisper & TTS 語音服務。
* 啟動 Electron 3D 桌面應用主程式。
