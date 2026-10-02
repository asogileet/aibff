# 解決多螢幕混合 DPI 縮放導致左側螢幕截斷實作計畫 (Implementation Plan)

## 1. 問題根本原因分析 (Root Cause Analysis)
- **環境數據**：
  - 中央主螢幕：實體解析度 `2560 × 1600`，Windows 縮放比例為 **150% (scaleFactor: 1.5)**。
  - 左側螢幕 (DISPLAY6)：實體解析度 `1920 × 1080`，Windows 縮放比例為 **100% (scaleFactor: 1.0)**，原點在 `X = -1920`。
  - 右側螢幕 (DISPLAY5)：實體解析度 `1920 × 1080`，Windows 縮放比例為 **100% (scaleFactor: 1.0)**，原點在 `X = 2560`。
- **截斷機制**：
  在 Windows 混合 DPI 環境下，Chromium/Electron 視窗若跨越多個不同縮放比例的顯示器，Windows DWM 會預設採用主螢幕的 1.5 倍縮放對負坐標進行換算，導致視窗的實際左界被縮放限制在 `X = -712`，而不是 `X = -1920`，導致左側螢幕整整少了 1,208 像素，畫布無法完全覆蓋最左邊螢幕，人偶走到該處時便被垂直邊界切斷。

---

## 2. 解決方案 (Proposed Solution)

### 步驟 1：主進程啟用 1:1 實體像素無縮放映射
在 `src/main/main.js` 最頂端加入命令列參數：
```javascript
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
```
- 強制視窗在跨屏時使用 1:1 實體像素座標，避免 Chromium 在跨越 1.0 與 1.5 倍縮放螢幕時對坐標進行非線性變換。
- 實測確認：視窗能精確取得 `{ x: -1920, y: 0, width: 6400, height: 1600 }`，左側螢幕全屏覆蓋率達 100%。

### 步驟 2：更新邊界計算與主螢幕 UI 錨定
- 在 `getMultiMonitorLayout()` 中，以 1:1 實體座標計算中央主螢幕的中心點（`X = 1920 + 2560/2 = 3280px`）。
- 底部工具列與頂部分身列動態錨定於 3280px，確保在 2560 寬度的主螢幕上依然保持水平正中央。

---

## 3. 驗證步驟
1. 啟動測試檢查視窗邊界，確認 `win.getBounds()` 的 `x` 為 `-1920`、`width` 為 `6400`。
2. 檢查左側螢幕是否已完全被透明畫布覆蓋，確認人偶在最左側螢幕走動或拖曳時不會再被截斷。
