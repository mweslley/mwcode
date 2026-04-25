# MWCode — Instalador Windows (PowerShell)
# Uso:
#   # Remoto:
#   iwr https://raw.githubusercontent.com/mweslley/mwcode/main/install.ps1 | iex
#   # Local:
#   .\install.ps1
#
# Requer: Windows 10+ com PowerShell 5.1+ (pwsh 7+ recomendado)

param(
    [string]$InstallDir = "$env:USERPROFILE\.mwcode",
    [string]$BinDir = "$env:LOCALAPPDATA\Microsoft\WindowsApps",
    [switch]$SkipCleanup,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Bold = "`e[1m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Red = "`e[31m"
$Blue = "`e[34m"
$Cyan = "`e[36m"
$Reset = "`e[0m"

function Log($msg, $color = "White") {
    $c = @{ Red = $Red; Yellow = $Yellow; Green = $Green; Blue = $Blue; Cyan = $Cyan; White = "" }
    Write-Host ("{0}{1}{2}{3}" -f $Bold, $c[$color], $msg, $Reset)
}

function Ok($m) { Log $m "Green" }
function Warn($m) { Log $m "Yellow" }
function Err($m) { Log $m "Red" }
function Info($m) { Log $m "Blue" }

function Has($cmd) { Get-Command $cmd -ErrorAction SilentlyContinue }
function Test-File($path) { Test-Path $path }
function Test-Dir($path) { Test-Path $path -PathType Container }

Log ""
Log "🚀 MWCode — Instalador Windows" "Cyan"
Log ""

$IsPwsh = $PSVersionTable.PSEdition -eq "Core"

# ============================================================
# 0. Fonte (local ou remoto)
# ============================================================
$sourceDir = $PSScriptRoot
if (Test-File "$sourceDir\.git") {
    $IsLocal = $true
    Info "Fonte: diretório local ($sourceDir)"
} else {
    $IsLocal = $false
    Info "Fonte: GitHub"
}
Log ""

# ============================================================
# 1. Limpar instalação anterior
# ============================================================
if (-not $SkipCleanup) {
    $cleaned = $false

    if (Test-File "$BinDir\mwcode.exe") {
        Remove-Item "$BinDir\mwcode.exe" -Force -ErrorAction SilentlyContinue
        Ok "Removido: $BinDir\mwcode.exe"
        $cleaned = $true
    }

    if (Test-File "$BinDir\mwcode.cmd") {
        Remove-Item "$BinDir\mwcode.cmd" -Force -ErrorAction SilentlyContinue
        Ok "Removido: $BinDir\mwcode.cmd"
        $cleaned = $true
    }

    if (Test-Dir $InstallDir) {
        Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
        Ok "Removido: $InstallDir"
        $cleaned = $true
    }

    if ($cleaned) { Log "" }
}

# ============================================================
# 2. Verificar dependências
# ============================================================
Info "Verificando dependências..."

if (-not (Has git)) {
    Err "git não instalado. Baixe em: https://git-scm.com/download/win"
    exit 1
}
$gitVer = (git --version) -replace ".*git version ", ""
Ok "git: $gitVer"

if (-not (Has curl)) {
    Err "curl não instalado"
    exit 1
}
Ok "curl"

# Node.js
if (-not (Has node)) {
    Warn "Node.js não encontrado. Instalando..."

    $nodeUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
    $nodeInstaller = "$env:TEMP\node-v20.18.0-x64.msi"

    curl -o $nodeInstaller -L $nodeUrl

    $proc = Start-Process msiexec -ArgumentList "/i", $nodeInstaller, "/quiet", "/norestart" -Wait -PassThru
    Remove-Item $nodeInstaller -Force -ErrorAction SilentlyContinue

    if ($proc.ExitCode -ne 0) {
        Err "Falha ao instalar Node.js"
        exit 1
    }

    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

if (-not (Has node)) {
    Err "Node.js não instalado"
    exit 1
}
Ok "node: $(node --version)"

if (-not (Has npm)) {
    Err "npm não encontrado"
    exit 1
}
Ok "npm: $(npm --version)"

# pnpm
if (-not (Has pnpm)) {
    Info "Instalando pnpm..."
    npm install -g pnpm
}

if (-not (Has pnpm)) {
    Err "pnpm não instalado"
    exit 1
}
Ok "pnpm: $(pnpm --version)"

# ============================================================
# 3. Baixar MWCode
# ============================================================
Info "Baixando MWCode..."
Log "   Diretório: $InstallDir"

if ($IsLocal) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Copy-Item -Path "$sourceDir\*" -Destination $InstallDir -Recurse -Exclude ".git"

    # Arquivos ocultos
    Get-ChildItem -Path $sourceDir -Force | Where-Object { $_.Name -like ".*" } | ForEach-Object {
        if ($_.Name -eq ".git") { return }
        Copy-Item -Path $_.FullName -Destination $InstallDir -Force
    }
} else {
    git clone --depth 1 https://github.com/mweslley/mwcode.git $InstallDir
}

Set-Location $InstallDir

# ============================================================
# 4. Instalar dependências
# ============================================================
Info "Instalando dependências..."
Invoke-Expression "pnpm install" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
    pnpm install
}

# ============================================================
# 5. Criar .env
# ============================================================
if (-not (Test-File "$InstallDir\.env")) {
    Copy-Item "$InstallDir\.env.example" "$InstallDir\.env"
    Ok ".env criado"
}

# ============================================================
# 6. Criar comando mwcode
# ============================================================
$cmdWrapper = "@echo off
`"$env:APPDATA\npm\pnpm.cmd`" `"%~dp0bin\mwcode.js`" %*
"

$cmdPath = "$InstallDir\mwcode.cmd"
Set-Content -Path $cmdPath -Value $cmdWrapper -Encoding ASCII

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$InstallDir*") {
    $newPath = "$InstallDir;$userPath"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Ok "Adicionado ao PATH"

    Warn "Reabra o terminal para usar 'mwcode'"
}

# ============================================================
# Final
# ============================================================
Log ""
Ok "🎉 Instalação concluída!"
Log ""
Log "Próximos passos:" "Bold"
Log "  1. Configure sua chave de API:"
Log "       notepad $InstallDir\.env" "Yellow"
Log "     (OPENROUTER_API_KEY recomendado)"
Log ""
Log "  2. Inicie o MWCode:"
Log "       mwcode" "Green"
Log ""
Log "  UI:  http://localhost:5173" "Bold"
Log "  API: http://localhost:3100" "Bold"
Log ""