# ============================================================
# Start-Distiller.ps1
# Avvia Chronicler Distiller in modalita' sviluppo
# ============================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$NodePath   = 'C:\Program Files\nodejs'
$Distiller  = Join-Path $PSScriptRoot 'distiller'

# ------------------------------------------------------------
# 1. Node.js nel PATH
# ------------------------------------------------------------
if (-not ($env:PATH -split ';' | Where-Object { $_ -eq $NodePath })) {
    $env:PATH = "$NodePath;$env:PATH"
}

$npmCmd = Join-Path $NodePath 'npm.cmd'
if (-not (Test-Path $npmCmd)) {
    Write-Error "Node.js non trovato in '$NodePath'. Installa Node.js da https://nodejs.org"
    exit 1
}

# ------------------------------------------------------------
# 2. Rimuove ELECTRON_RUN_AS_NODE (impostato da VSCode)
#    Senza questo, Electron gira come Node puro e le API
#    (app, BrowserWindow, ecc.) non sono disponibili.
# ------------------------------------------------------------
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

# ------------------------------------------------------------
# 3. Installa dipendenze se node_modules e' assente
# ------------------------------------------------------------
$nodeModules = Join-Path $Distiller 'node_modules'
if (-not (Test-Path $nodeModules)) {
    Write-Host "`nInstallazione dipendenze..." -ForegroundColor Cyan
    & $npmCmd install --prefix $Distiller
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install fallito."
        exit 1
    }
}

# ------------------------------------------------------------
# 4. Avvio
# ------------------------------------------------------------
Write-Host "`nAvvio Chronicler Distiller..." -ForegroundColor Green
Set-Location $Distiller
& $npmCmd run dev
