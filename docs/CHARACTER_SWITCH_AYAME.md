# 3D 虛擬伴侶 - 百鬼綾目 (Ayame) 角色切換功能開發規格書

## 1. 需求背景與目標

使用者於 `assets/models/ayame.vrm` 加入了知名 Hololive 虛擬角色「百鬼綾目（Nakiri Ayame）」之 3D VRM 模型（檔案大小約 15.5MB）。
本功能之目標為將 Ayame 整合至現有桌面 AI 女友應用程式中，使使用者能夠在介面、托盤以及 AI 意圖調度中自由切換角色（包括經典伴侶「小櫻」的 5 種造型，以及新角色「百鬼綾目」）。

---

## 2. 系統架構與相容性設計

### 2.1 模型資源映射
* 模型實體路徑：`assets/models/ayame.vrm`
* 內部識別 ID：`ayame`
* 渲染器對應路徑：`../../assets/models/ayame.vrm`

### 2.2 3D 渲染與骨骼姿態校正
1. **面向角度（Orientation）**：
   * Ayame 為標準 VRM 模型，面向攝影機之初始旋轉為 `Math.PI`（180度）。
2. **手臂放鬆姿態（Relaxed Pose）**：
   * VRM 預設可能為 T-pose 或 A-pose。
   * 模型載入時對稱下壓雙臂（`leftUpperArm.rotation.z = Math.PI * 0.38`, `rightUpperArm.rotation.z = -Math.PI * 0.38`），避免姿態僵硬。
3. **材質保護（Material Protection）**：
   * 既有的小櫻服裝著色邏輯（`Alicia_wear`、`Alicia_other`）自動避開 Ayame 專屬材質，保留 Ayame 原生紅白和服、鬼角與面部貼圖。

### 2.3 互動與台詞設計
* **切換至百鬼綾目專屬台詞**：
  * 「Konnakiri～！余是百鬼綾目！主人今天也是元氣滿滿的一天呢～😈」
* **摸摸頭（Head Pat）反饋**：
  * 動態相容百鬼綾目的頭部碰撞體與鬼角，提供軟萌親切的語音與表情互動。

### 2.4 選單與系統整合
1. **前端換裝/外觀面板 (`CostumeSelector.js`)**：
   * 在選單清單中加入百鬼綾目選項（圖示：😈，名稱：百鬼綾目 (Ayame)）。
2. **系統托盤選單 (`main.js`)**：
   * 在托盤右鍵「換裝 (Costumes)」選單中，加入「百鬼綾目 (Ayame)」快捷切換選項。
3. **控制器核心 (`AvatarController.js`)**：
   * 擴充 `this.costumePaths` 包含 `ayame: '../../assets/models/ayame.vrm'`。
   * 擴充 `this.modelOrientations`。
4. **意圖調度器 (`ActionController.js`)**：
   * 支援 `costume: 'ayame'` 意圖分發，觸發專屬語音與對話框。

---

## 3. 測試與驗證計畫
* 驗證點 1：開啟換裝面板，確認出現「百鬼綾目 (Ayame)」按鈕。
* 驗證點 2：點擊切換百鬼綾目，確認 3D 場景正確載入 `ayame.vrm`，鬼角、服裝與貼圖正常渲染。
* 驗證點 3：確認呼吸動畫、眨眼、視線跟隨以及摸頭射線檢測在 Ayame 模型上運作流暢。
* 驗證點 4：確認系統托盤右鍵切換至 Ayame 亦能即時生效。
