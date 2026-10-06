# 3D 桌面 AI 女友 (Windows 11 PowerShell 啟動腳本)
$Host.UI.RawUI.WindowTitle = "3D 桌面 AI 女友"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Magenta
Write-Host "       ✨ 3D 桌面 AI 女友 (Windows 11 專屬版本) ✨" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Magenta
Write-Host ""

$LLAMA_URL = "http://127.0.0.1:8080/v1/models"
$OLLAMA_URL = "http://127.0.0.1:11434"

# 1. 檢查本地 LLM 服務
Write-Host "[1/4] 正在檢查本地 LLM 服務狀態..." -ForegroundColor Yellow
$llmDetected = $false

# 檢查 llama-server (8080)
try {
    $res = Invoke-RestMethod -Uri $LLAMA_URL -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($res) {
        $modelName = $res.data[0].id
        Write-Host "[成功] 偵測到本地 llama-server 運行於 Port 8080！" -ForegroundColor Green
        Write-Host "[模型] 目前載入模型: $modelName" -ForegroundColor Cyan
        $llmDetected = $true
    }
} catch {}

# 檢查 Ollama (11434)
if (-not $llmDetected) {
    try {
        $res = Invoke-WebRequest -Uri $OLLAMA_URL -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($res.StatusCode -eq 200) {
            Write-Host "[成功] 偵測到本地 Ollama 服務運行於 Port 11434！" -ForegroundColor Green
            $llmDetected = $true
        }
    } catch {}
}

if (-not $llmDetected) {
    Write-Host "[提示] 未偵測到運行中的本地 LLM 服務，程式將以離線預設備用模式運行。" -ForegroundColor Yellow
}
Write-Host ""

# 2. 啟動 Python 後端語音與 AI 服務
Write-Host "[2/4] 正在啟動 Python 後端語音與 AI 服務 (Port: 8765)..." -ForegroundColor Yellow
Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "backend.app:app", "--host", "127.0.0.1", "--port", "8765" -WorkingDirectory $PSScriptRoot -WindowStyle Minimized -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "[成功] 後端語音與 AI 服務已就緒。" -ForegroundColor Green
Write-Host ""

# 3. 啟動 Electron 3D 桌面主程式
Write-Host "[3/4] 正在啟動 3D 桌面應用主程式..." -ForegroundColor Cyan
Write-Host "操作提示：" -ForegroundColor Gray
Write-Host "  - 摸摸頭: 滑鼠輕點小櫻頭部" -ForegroundColor Gray
Write-Host "  - 拖曳角色: 按住身體或頭部拖曳移動" -ForegroundColor Gray
Write-Host "  - 全域喚醒快捷鍵: Ctrl + Alt + G" -ForegroundColor Gray
Write-Host "  - 系統托盤: 桌面右下角愛心圖示" -ForegroundColor Gray
Write-Host ""

npm start
