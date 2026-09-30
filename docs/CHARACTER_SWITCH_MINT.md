# 3D 虛擬伴侶 - 泳裝薄荷 (Mint) 角色切換功能開發規格書

## 1. 需求背景與目標

使用者於系統中匯入了《異環》（Neverness to Everness）的高人氣角色「薄荷」泳裝 3D 模型 `mint_swimsuit_animated-_neverness_to_everness.glb`，並已透過 Blender 5.2 與 VRM Add-on 成功轉檔為具備 2D Anime Flat Shading（MToon1 / 全自發光材質、無陰影光照干擾）且綁定標準 Humanoid 人形骨架之 `assets/models/mint_swimsuit.vrm`（約 5.28 MB）。

本功能之目標為將「泳裝薄荷 (Mint)」正式整合入桌面 AI 女友應用程式中，提供以下能力：
1. **多角色自由切換**：使用者可透過桌面前端 UI「角色與外觀面板」與 Windows 系統托盤（System Tray）一鍵切換至薄荷。
2. **2D Anime 賽璐珞風格呈現**：維持高品質無雜色陰影之二次元平塗渲染效果。
3. **專屬台詞與互動**：切換時觸發薄荷專屬泳裝台詞（「哇！是海邊的感覺！我是薄荷，主人要和我一起去海邊玩嗎～？🩱」），相容摸頭互動與表情反應。
4. **骨骼與姿態自動校正**：自動適配 Humanoid 標準骨骼、放鬆站立手臂角度與視線追蹤。

---

## 2. 系統架構與相容性設計

### 2.1 模型資源映射
* 模型實體路徑：`assets/models/mint_swimsuit.vrm`
* 內部識別 ID：`mint`
* 前端渲染器路徑：`../../assets/models/mint_swimsuit.vrm`
* 顯示名稱：`泳裝薄荷 (Mint)`
* UI 圖示：`🩱`

### 2.2 3D 渲染與骨骼姿態校正
1. **面向角度（Orientation）**：
   * `mint_swimsuit.vrm` 符合 VRM 標準座標系，面向攝影機初始旋轉角設為 `Math.PI`（180 度）。
2. **自然站立手臂姿態（Relaxed Pose）**：
   * VRM 匯出標準為 T-pose，模型載入時由 `AvatarController` 對稱下壓雙臂（`leftUpperArm` 與 `rightUpperArm`），呈現自然輕鬆站姿。
3. **材質保護（Material Protection）**：
   * 避開小櫻服裝染色邏輯（`Alicia_wear`、`Alicia_other`），完整保留薄荷原生 MToon1 2D 動漫平塗材質。

### 2.3 互動與台詞設計
* **切換至薄荷專屬台詞**：
  * UI 點擊：「哇！是海邊的感覺！我是薄荷，主人要和我一起去海邊玩嗎～？🩱」
  * 系統托盤點擊：「哇！換成泳裝薄荷啦！主人覺得這套泳裝好看嗎～？🩱」
* **摸摸頭（Head Pat）反饋**：
  * 相容 Humanoid `head` 骨骼位置射線檢測，自然觸發對話氣泡與表情。

### 2.4 系統整合點
1. **前端換裝面板 (`src/renderer/ui/CostumeSelector.js`)**：
   * 加入 `{ id: 'mint', name: '泳裝薄荷 (Mint)', icon: '🩱', file: 'mint_swimsuit.vrm' }`。
2. **控制器核心 (`src/renderer/vrm/AvatarController.js`)**：
   * 擴充 `this.costumePaths['mint'] = '../../assets/models/mint_swimsuit.vrm'`。
   * 擴充 `this.modelOrientations['mint'] = Math.PI`。
3. **主渲染進程分發器 (`src/renderer/app.js`)**：
   * 在 `costumeSelector` 回呼與 `window.electronAPI.onCostumeChange` 中加入 `mint` 專屬歡迎台詞與表情分發。
4. **Electron 主進程托盤選單 (`src/main/main.js`)**：
   * 在托盤 `換裝與角色 (Costumes & Characters)` 選單中新增 `{ label: '泳裝薄荷 (Mint)', click: () => sendCostume('mint') }`。

---

## 3. 測試與驗證計畫（待授權後擬定執行）
* 驗證點 1：換裝面板渲染包含泳裝薄荷圖示與資訊。
* 驗證點 2：切換至薄荷時平滑銷毀前一個 VRM 模型並載入 `mint_swimsuit.vrm`。
* 驗證點 3：薄荷模型呈現正常 2D 動畫平塗、手臂自然放鬆。
* 驗證點 4：托盤選單點擊切換薄荷正常響應。
