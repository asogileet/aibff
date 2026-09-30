# GLB → VRM 轉檔腳本（泳裝薄荷 Mint）

把 `assets/models/mint_swimsuit_animated-_neverness_to_everness.glb`（Sketchfab 下載）
轉成 `assets/models/mint_swimsuit.vrm`（VRM 0.x）。

## 需求

- Blender 5.2，並已安裝 **VRM format** 擴充（`bl_ext.user_default.vrm`，4.7.2 測試過）
- 來源 GLB 放在 `assets/models/`

## 執行

在 repo 根目錄：

```bash
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python tools/vrm_convert/convert.py
```

加上 `-- --preview` 會另外把每個表情渲染成 `_work/e_<名稱>.png`，方便調整後檢查。

輸出會直接覆蓋 `assets/models/mint_swimsuit.vrm`。中間檔（去動畫的 GLB、`.blend`、
MToon 版 VRM）放在 `tools/vrm_convert/_work/`，已被 git 忽略。

## 各檔案

| 檔案 | 作用 |
| --- | --- |
| `convert.py` | 進入點：表情、材質、VRM 設定（humanoid、lookAt、彈簧骨、meta）、匯出 |
| `build.py` | 匯入 GLB、只留本體、重建 T-pose 並烘成 rest pose、轉成 Z-up 置中落地 |
| `common.py` | 路徑、去除 GLB 動畫、預覽渲染 |
| `postprocess.py` | 把匯出的 VRM 所有材質改成無光照（`KHR_materials_unlit` + `VRM_USE_GLTFSHADER`） |

## 常調的地方（都在 `convert.py`）

- **表情幅度**：`EXPR` 字典。原模型沒有 blend shape，表情是移動臉部骨骼後烘成 shape key：
  `mouth(open, width, corner_up)`、`eyes(close, lower_up)`、`brows(inner, mid, outer)`，單位是公尺。
- **彈簧骨**：檔尾的 `spring(名稱, 骨骼名 regex, stiffness, gravity, drag)`。目前沒有碰撞體。
- **授權 / 作者資訊**：`meta.*`。

## 已知限制

- 草帽、胸前蝴蝶結、緞帶在來源檔裡是沒有掛載位置的獨立配件，`build.py` 會直接捨棄。
- 來源檔的 578 幀動畫不會帶入 VRM。
- 骨骼名稱、`Object_143` 等是這個 GLB 專屬的，換別的模型需要改對應表。
