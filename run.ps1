# 3D Desktop AI Girlfriend Launcher
$Host.UI.RawUI.WindowTitle = "3D Desktop AI Girlfriend"
Set-Location $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Magenta
Write-Host "       3D Desktop AI Girlfriend (Windows 11 Edition)   " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Magenta
Write-Host ""

$LLAMA_URL = "http://127.0.0.1:8080/v1/models"
$OLLAMA_URL = "http://127.0.0.1:11434"

# 1. Check Local LLM Service
Write-Host "[1/3] Checking local LLM service..." -ForegroundColor Yellow
$llmDetected = $false

try {
    $res = Invoke-RestMethod -Uri $LLAMA_URL -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($res -and $res.data) {
        $modelName = $res.data[0].id
        Write-Host "[SUCCESS] Detected llama-server on Port 8080!" -ForegroundColor Green
        Write-Host "[MODEL] Active Model: $modelName" -ForegroundColor Cyan
        $llmDetected = $true
    }
} catch {
}

if (-not $llmDetected) {
    try {
        $res = Invoke-WebRequest -Uri $OLLAMA_URL -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($res.StatusCode -eq 200) {
            Write-Host "[SUCCESS] Detected Ollama service on Port 11434!" -ForegroundColor Green
            $llmDetected = $true
        }
    } catch {
    }
}

if (-not $llmDetected) {
    Write-Host "[NOTICE] No local LLM detected. Application will use client fallback rules." -ForegroundColor Yellow
}
Write-Host ""

# 2. Launch Python Backend Service
Write-Host "[2/3] Starting Python backend service (Port: 8765)..." -ForegroundColor Yellow
Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8765" -WorkingDirectory $PSScriptRoot -WindowStyle Minimized -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "[SUCCESS] Backend service is running in background (0.0.0.0:8765)." -ForegroundColor Green

$localIps = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet' -and $_.IPAddress -notmatch '^169\.254\.' } | Select-Object -ExpandProperty IPAddress)
if ($localIps.Count -gt 0) {
    Write-Host "[MOBILE] Mobile Web URL: http://$($localIps[0]):8765/" -ForegroundColor Magenta
}
Write-Host ""

# 3. Launch Electron Frontend
Write-Host "[3/3] Launching 3D Desktop Girlfriend application..." -ForegroundColor Cyan
Write-Host "Hints:" -ForegroundColor Gray
Write-Host "  - Head Pat: Click avatar head" -ForegroundColor Gray
Write-Host "  - Move Window: Drag avatar body" -ForegroundColor Gray
Write-Host "  - Global Recall: Ctrl + Alt + G" -ForegroundColor Gray
Write-Host "  - System Tray: Pink heart icon in taskbar" -ForegroundColor Gray
Write-Host ""

npm start