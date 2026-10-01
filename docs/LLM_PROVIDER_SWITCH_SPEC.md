# LLM 多提供者動態切換與 NVIDIA NIM API 整合規格書

## 1. 需求與目標
使用者希望為 3D 桌面虛擬伴侶系統接入 **NVIDIA NIM (NVIDIA Inference Microservice / build.nvidia.com) API**，並能在系統中自由選擇與切換不同 LLM 提供者（例如本地 Ollama、雲端 NVIDIA NIM、或自訂 OpenAI 相容端點），實現免重啟即時熱生效。

---

## 2. 系統架構變更分析

### 2.1 後端架構 (FastAPI + Pydantic + HTTPX)
1. **設定模型擴充 (`backend/config.py`)**：
   - 在 `LLMConfig` 中新增欄位：
     - `provider`: `str`（`"ollama"` | `"nvidia"` | `"custom"`，預設 `"ollama"`）
     - `api_key`: `Optional[str]`（NVIDIA 或雲端服務所需之 Bearer Token，預設為空字串）
     - `max_tokens`: `int`（預設 256）
2. **LLM 客戶端升級 (`backend/llm/ollama_client.py`)**：
   - 支援 Bearer Token 授權標頭（`Authorization: Bearer <api_key>`）。
   - 保留深層文本淨化機制（`_sanitize_for_display` 與 `_sanitize_for_speech`）以適配各種開源模型（Llama 3.3、DeepSeek R1、Nemotron 等可能輸出的思考標籤 `<think>...</think>` 或 Markdown 結構）。
   - 支援標準 OpenAI `/chat/completions` 與本機端點 fallback。
3. **熱重載機制 (`backend/app.py`)**：
   - 當前端呼叫 `POST /api/config` 更新設定時，依據新設定即時重新初始化 `llm_client`，新對話立即使用新配置。

### 2.2 前端設定介面 (Renderer / `SettingsModal.js`)
1. **提供者選擇按鈕/分頁**：
   - 提供「🦙 Ollama (本地)」、「🟢 NVIDIA NIM」、「🌐 自訂相容 API」三種模式。
2. **動態表單與預設推薦**：
   - 切換至 **NVIDIA NIM** 時：
     - API URL 自動帶入 `https://integrate.api.nvidia.com/v1`
     - 顯示 API Key 輸入欄位（支援顯示/隱藏密碼，提示取得網址）
     - 模型選單預載推薦模型：
       - `meta/llama-3.3-70b-instruct`
       - `deepseek-ai/deepseek-r1`
       - `nvidia/llama-3.1-nemotron-70b-instruct`
       - `meta/llama-3.1-8b-instruct`
       - `mistralai/mistral-large-2-instruct`
       - 手動自訂輸入
   - 切換至 **Ollama (本地)** 時：
     - API URL 預設帶入 `http://127.0.0.1:11434`
     - 隱藏 API Key 欄位
     - 模型選單預載：`qwen2.5:7b`、`llama3.1:8b` 等
3. **設定儲存**：
   - 透過 `/api/config` 同步寫回本機 `config.json`。

---

## 3. 介面原型 (Mockup)
- 靜態與互動原型已建置於：[llm_provider_switch_mockup.html](file:///c:/github/aibff/mockup/llm_provider_switch_mockup.html)
- 包含連線狀態測試（Ping）、模型選單連動、密碼遮蔽與即時意圖解析預覽。

---

## 4. 安全與容錯規範
1. **API Key 本地保護**：API Key 僅存在使用者的本機 `config.json` 中，不對外廣播。
2. **降級保護 (Fallback)**：若 NVIDIA API 額度用盡、網路超時或斷線，系統自動降級至本地備用回覆與動作狀態機，確保 3D 伴侶不會拋出崩潰異常。
