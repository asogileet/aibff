# 3D VRM 擴充動作庫規格文件 (NEW ACTIONS SPECIFICATION)

本文件定義 3D 虛擬伴侶系統新增之 **6 大動作庫（青蛙坐姿、學動物四肢著地、趴下、躺下、開合跳、跳舞）** 之骨骼運動學 (Kinematics)、動作狀態機制、語音與意圖識別、UI 按鈕配置與對話回覆規格。

---

## 1. 動作概覽與分類

| 動作 ID (`action`) | 動作名稱 | 模式類型 | 動態特徵 | 預設情緒 | 適用情境 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `frog_sit` | 青蛙坐姿 | 常態保持 (Persistent) | 臀部貼地，雙大腿大幅外展，雙膝深彎，雙手置於膝間支撐 | `shy` | 撒嬌、地面休閒、日系可愛坐姿 |
| `animal_crawl` | 學動物四肢著地 | 常態保持 (Persistent) | 雙手與雙膝著地，背部前傾水平，頸部後仰使頭部抬起直視前方 | `happy` | 角色扮演、小動物擬態 (貓貓/狗狗) |
| `prone` | 趴下放鬆 | 常態保持 (Persistent) | 胸腹著地貼平，雙腿後伸放鬆，手肘彎曲支撐微抬頭托腮 | `caring` | 放鬆休息、趴在地上發呆、慵懶互動 |
| `supine` | 平靜躺下 | 常態保持 (Persistent) | 背部貼地平躺，雙手放鬆置於身側或腹部，雙腿伸直微屈 | `happy` | 躺平睡覺、看天花板、放鬆療癒 |
| `jumping_jacks` | 開合跳健身 | 週期循環 (Loop) | 週期性騰空躍起，雙腿開展落地收合，雙臂於頭頂合攏擊掌 | `happy` | 活力運動、有氧健身、互動打氣 |
| `dance` | 活力元氣舞 | 週期循環 (Loop) | 臀部左右律動擺胯，雙臂隨節奏交替波浪擺動，粒子特效綻放 | `happy` | 慶祝開心、才藝表演、元氣互動 |

---

## 2. 骨骼運動學參數詳細規格 (Three.js VRM Humanoid)

### 2.1 青蛙坐姿 (M字腿) (`frog_sit`)
- **Hips 位移**：`hips.position.y = baseHipsY - 0.54m`，`hips.position.z = 0.10m`。
- **下肢 (M字雙峰與外展)**：
  - `leftUpperLeg.rotation.set(1.25, 0.10, 0.75)` (大腿抬起並大幅向外開展成 M 字兩側)。
  - `rightUpperLeg.rotation.set(1.25, -0.10, -0.75)`。
  - `leftLowerLeg.rotation.set(-1.15, 0.0, 0.0)` (膝蓋高拱形成 M 頂峰，小腿垂直向下)。
  - `rightLowerLeg.rotation.set(-1.15, 0.0, 0.0)`。
  - `leftFoot.rotation.set(0.35, 0.0, 0.0)` (腳掌平踩於兩側地面)。
  - `rightFoot.rotation.set(0.35, 0.0, 0.0)`。
- **上肢與軀幹 (雙手置於雙腿中央地面支撐)**：
  - `spine.rotation.set(0.20, 0.0, 0.0)` (軀幹微前傾)。
  - `head.rotation.set(-0.08, 0.0, 0.0)`。
  - `leftUpperArm.rotation.set(0.55, 0.0, 0.18)` (雙臂前傾垂於兩膝之間)。
  - `rightUpperArm.rotation.set(0.55, 0.0, -0.18)`。
  - `leftLowerArm.rotation.set(0.0, 0.0, 0.0)`。
  - `rightLowerArm.rotation.set(0.0, 0.0, 0.0)`。
  - `leftHand.rotation.set(-0.45, 0.0, 0.0)` (手掌平貼在地面上支撐)。
  - `rightHand.rotation.set(-0.45, 0.0, 0.0)`。

### 2.2 學動物 四肢著地 頭抬向前 (`animal_crawl`)
- **Hips 位移**：`hips.position.y = baseHipsY - 0.40m`。
- **軀幹與頭部 (Spine & Head)**：
  - `spine.rotation.set(1.35, 0.0, 0.0)` (軀幹水平前傾約 78 度，呈動物匍匐軀幹)。
  - `head.rotation.set(-0.95, 0.0, 0.0)` (頸部向上仰起約 -55 度，頭部正對前方直視鏡頭/主人)。
- **前肢支撐 (Arms)**：
  - `leftUpperArm.rotation.set(1.30, 0.0, 0.15)` (雙臂垂直支撐在前方地面)。
  - `rightUpperArm.rotation.set(1.30, 0.0, -0.15)`。
  - `leftLowerArm.rotation.set(0.35, 0.0, 0.0)`。
  - `rightLowerArm.rotation.set(0.35, 0.0, 0.0)`。
- **後肢支撐 (Legs)**：
  - `leftUpperLeg.rotation.set(0.45, 0.0, 0.12)`。
  - `rightUpperLeg.rotation.set(0.45, 0.0, -0.12)`。
  - `leftLowerLeg.rotation.set(-1.85, 0.0, 0.0)` (膝蓋跪地，小腿後貼)。
  - `rightLowerLeg.rotation.set(-1.85, 0.0, 0.0)`。

### 2.3 趴下放鬆 (`prone`)
- **Hips 旋轉與位移 (全身根節點旋轉)**：
  - `hips.rotation.x = Math.PI * 0.48` (~86°，全身往前放倒貼向地面，非折腰)。
  - `hips.position.y = baseHipsY - 0.72m` (貼齊地面)，`hips.position.z = 0.20m`。
- **軀幹與頭部 (Spine & Head)**：
  - `spine.rotation.x = -0.15 rad` (胸部微微托起，避免胸部陷入地面)。
  - `head.rotation.x = -0.85 rad` (頸部後仰，頭部抬起直視前方鏡頭與主人)。
- **上肢與下肢 (Arms & Legs)**：
  - `leftUpperArm.rotation.set(-0.85, 0.45, 0.35)` (雙臂向前伸出至胸前地面)。
  - `rightUpperArm.rotation.set(-0.85, -0.45, -0.35)`。
  - `leftLowerArm.rotation.set(0.0, 1.45, 0.0)` (小臂在下巴前方水平橫折托腮/枕手)。
  - `rightLowerArm.rotation.set(0.0, -1.45, 0.0)`。
  - `leftHand.rotation.set(0.0, 0.0, 0.0)`。
  - `rightHand.rotation.set(0.0, 0.0, 0.0)`。
  - `leftUpperLeg.rotation.set(0.05, 0.0, 0.12)` (雙腿自然向後微展平放於地面)。
  - `rightUpperLeg.rotation.set(0.05, 0.0, -0.12)`。
  - `leftLowerLeg.rotation.set(-0.15, 0.0, 0.0)`。
  - `rightLowerLeg.rotation.set(-0.15, 0.0, 0.0)`。

### 2.4 平靜躺下 (`supine`)
- **Hips 旋轉與位移 (全身根節點旋轉)**：
  - `hips.rotation.x = -Math.PI * 0.48` (~-86°，全身往後放倒平躺，非下腰)。
  - `hips.position.y = baseHipsY - 0.72m`，`hips.position.z = -0.20m`。
- **軀幹與頭部 (Spine & Head)**：
  - `spine.rotation.x = 0.05 rad`。
  - `head.rotation.x = 0.30 rad` (頭部自然枕地仰面)。
- **上肢與下肢 (Arms & Legs)**：
  - `leftUpperArm.rotation.set(0.0, 0.0, 0.45)` (雙手平攤置於身側兩旁)。
  - `rightUpperArm.rotation.set(0.0, 0.0, -0.45)`。
  - `leftLowerArm.rotation.set(0.0, 0.0, 0.0)`。
  - `rightLowerArm.rotation.set(0.0, 0.0, 0.0)`。
  - `leftUpperLeg.rotation.set(0.0, 0.0, 0.10)`。
  - `rightUpperLeg.rotation.set(0.0, 0.0, -0.10)`。
  - `leftLowerLeg.rotation.set(0.0, 0.0, 0.0)`。
  - `rightLowerLeg.rotation.set(0.0, 0.0, 0.0)`。

### 2.5 開合跳健身 (`jumping_jacks`)
- **動作週期**：使用全幅平滑震盪因子 `t = (Math.sin(actionTime * 6.0) + 1.0) * 0.5`（0 到 1 連續平滑過渡）。
- **騰空躍起 (`t → 1`)**：
  - `hips.position.y = baseHipsY + 0.22m` (躍起騰空)。
  - `leftUpperArm.rotation.z = THREE.MathUtils.lerp(Math.PI * 0.38, -1.75, t);` (手臂自下垂 +1.19 向上舉起至頭頂 -1.75 擊掌)。
  - `rightUpperArm.rotation.z = THREE.MathUtils.lerp(-Math.PI * 0.38, 1.75, t);` (手臂自下垂 -1.19 向上舉起至頭頂 +1.75 擊掌)。
  - `leftUpperLeg.rotation.z = t * 0.45;` (雙腿外展開展)。
  - `rightUpperLeg.rotation.z = -t * 0.45;`
- **落地緩衝 (`t → 0`)**：
  - 骨盆回落地面基準線，雙膝微屈緩衝吸震 (`-cushion * 0.35`)。
  - 雙手回到大腿身側、雙腿併攏收齊。

### 2.6 活力元氣舞 (`dance`)
- **動作週期**：頻率約 4.0 Hz（節奏韻律約 1.5 秒一拍）。
- **骨盆擺胯 (Hips)**：
  - `hips.position.x = Math.sin(actionTime * 4.0) * 0.06;` (左右輕快踏步)
  - `hips.position.y = baseHipsY + Math.abs(Math.sin(actionTime * 8.0)) * 0.03;` (上下小彈跳)
  - `hips.rotation.z = Math.sin(actionTime * 4.0) * 0.12;`
- **雙臂韻律揮動**：
  - `leftUpperArm.rotation.z = Math.PI * 0.32 + Math.sin(actionTime * 4.0) * 0.35;` (對稱側擺)
  - `rightUpperArm.rotation.z = -Math.PI * 0.32 - Math.sin(actionTime * 4.0) * 0.35;`
  - `leftUpperArm.rotation.x = 0.30 + Math.cos(actionTime * 4.0) * 0.25;`
  - `rightUpperArm.rotation.x = 0.30 - Math.cos(actionTime * 4.0) * 0.25;`
  - **手肘 Y 軸向前彎折**：
    - `leftLowerArm.rotation.set(0, 0.75 + Math.sin(actionTime * 8.0) * 0.25, 0);`
    - `rightLowerArm.rotation.set(0, -0.75 - Math.sin(actionTime * 8.0) * 0.25, 0);`
- **粒子特效觸發**：伴隨愛心粒子 `spawnHeartParticles(10)`。

---

## 3. 動作台詞與預設情緒 (Action Quotes)

| 動作 ID | 預設對話文字 (`reply`) | 情感 (`emotion`) |
| :--- | :--- | :--- |
| `frog_sit` | 「主人～這個是青蛙坐姿哦！像不像一隻可愛的小青蛙呢？呱呱～🐸」 | `shy` |
| `animal_crawl` | 「喵～！汪汪～！小櫻現在變成小動物啦，四肢著地頭抬高高看著主人哦🐾」 | `happy` |
| `prone` | 「哈啊～直接趴在地上好舒服哦……主人也想一起趴下放鬆發呆嗎？💤」 | `caring` |
| `supine` | 「望著天花板放空～小櫻躺平囉！主人工作累了也要好好休息呢～✨」 | `happy` |
| `jumping_jacks` | 「一、二、一、二！開合跳運動開始！主人跟小櫻一起保持健康活力～💪」 | `happy` |
| `dance` | 「啦啦啦～🎵 小櫻為主人跳一支專屬元氣舞蹈！希望主人每天都開開心心！💃✨」 | `happy` |

---

## 4. 語音辨識與 LLM 意圖識別關鍵字

在 `backend/llm/ollama_client.py` 的意圖提取邏輯中擴充：

```python
elif any(w in raw_lower for w in ["青蛙坐", "青蛙坐姿", "學青蛙"]):
    emotion = "shy"
    action = "frog_sit"
elif any(w in raw_lower for w in ["四肢著地", "學動物", "學狗", "學貓", "頭抬向前", "爬行", "動物爬"]):
    emotion = "happy"
    action = "animal_crawl"
elif any(w in raw_lower for w in ["趴下", "趴著", "趴在地上", "趴在桌上"]):
    emotion = "caring"
    action = "prone"
elif any(w in raw_lower for w in ["躺下", "躺著", "躺平", "躺在地上", "仰躺"]):
    emotion = "happy"
    action = "supine"
elif any(w in raw_lower for w in ["開合跳", "跳開合", "開合跳運動"]):
    emotion = "happy"
    action = "jumping_jacks"
elif any(w in raw_lower for w in ["跳舞", "跳一支舞", "跳個舞", "舞蹈", "跳元氣舞"]):
    emotion = "happy"
    action = "dance"
```

並在站立/停止動作關鍵字中加入：
```python
"不要趴了", "不要躺了", "不要跳了", "停止跳舞", "停止開合跳", "起來站好"
```
使模型與指令能平順恢復到站立 (`stand`)。

---

## 5. 前端 UI 選單配置 (`ActionSelector.js`)

動作選單擴充後將從原本 16 項增至 **22 項**（含待機站姿）：
- 🐸 青蛙坐姿 (`frog_sit`) - 描述：青蛙蹲坐
- 🐾 學動物 (`animal_crawl`) - 描述：四肢著地抬頭
- 🙇‍♀️ 趴下放鬆 (`prone`) - 描述：平趴地面
- 🛏️ 平靜躺下 (`supine`) - 描述：仰臥平躺
- 🤸‍♀️ 開合跳 (`jumping_jacks`) - 描述：有氧跳躍
- 💃 活力元氣舞 (`dance`) - 描述：偶像舞蹈

選單標題更新為：`💃 21 大動作庫 (互動與全身)`。

---

## 6. 原型展示連結

- 互動 HTML Mockup 檔案路徑：`mockup/expanded_actions_mockup.html`
- 支援 SVG 即時骨骼運動學角度與位移視覺化、骨骼參數表、對話切換與運動循環模擬。
