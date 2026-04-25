# MWCode — Instalador Único Universal (Windows)
# Execute no PowerShell (como Administrador):
#   iwr https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.ps1 | iex
#
# Ou salve e execute:
#   Invoke-WebRequest -Uri "https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.ps1" -OutFile "$env:TEMP\install-unico.ps1"
#   & "$env:TEMP\install-unico.ps1"

param(
    [string]$InstallDir = "$env:USERPROFILE\.mwcode",
    [string]$Port = "3100",
    [switch]$Start
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$BOLD = "`e[1m"
$GREEN = "`e[32m"
$YELLOW = "`e[33m"
$RED = "`e[31m"
$CYAN = "`e[36m"
$RESET = "`e[0m"

function Log($m, $c="White") { Write-Host "$c$m$RESET" }
function Ok($m) { Log "✓ $m" $GREEN }
function Warn($m) { Log "⚠ $m" $YELLOW }
function Err($m) { Log "✗ $m" $RED }
function Inf($m) { Log "ℹ $m" $CYAN }
function Die($m) { Err $m; exit 1 }

function Has($cmd) { Get-Command $cmd -ErrorAction SilentlyContinue }

Log ""
Log "$BOLD🚀 MWCode — Instalador Único Universal$RESET" $CYAN
Log ""

# ============================================================
# 0. Verificar PowerShell
# ============================================================
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Die "PowerShell 5.1+ necessário. Atualize o Windows."
}

# ============================================================
# 1. Limpar instalação anterior
# ============================================================
Inf "Verificando instalação anterior..."

if (Test-Path $InstallDir) {
    Log "Removendo instalação anterior: $InstallDir" $YELLOW
    Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
    Ok "Instalação anterior removida"
}

# Remover symlinks
@("$env:LOCALAPPDATA\Microsoft\WindowsApps", "$env:APPDATA", "$env:USERPROFILE\bin") | ForEach-Object {
    $path = $_
    if (Test-Path $path) {
        Remove-Item "$path\mwcode.cmd" -Force -ErrorAction SilentlyContinue
        Remove-Item "$path\mwcode.exe" -Force -ErrorAction SilentlyContinue
    }
}

Log ""

# ============================================================
# 2. Node.js 20+
# ============================================================
Inf "Verificando Node.js..."

$nodeOk = $false
if (Has node) {
    $version = node --version -replace "v", ""
    $major = [int]($version -split "\.")[0]
    if ($major -ge 20) {
        $nodeOk = $true
    }
}

if (-not $nodeOk) {
    Warn "Node.js 20+ não encontrado. Instalando..."
    
    $nodeUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
    $nodeInstaller = "$env:TEMP\node-v20.18.0-x64.msi"
    
    try {
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller -ErrorAction Stop
        Start-Process msiexec -ArgumentList "/i", $nodeInstaller, "/quiet", "/norestart" -Wait -PassThru | Out-Null
        Remove-Item $nodeInstaller -Force -ErrorAction SilentlyContinue
        
        # Atualizar PATH
        $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
        $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
        $env:Path = "$machinePath;$userPath"
    } catch {
        Die "Falha ao instalar Node.js: $_"
    }
}

Has node || Die "Node.js não instalado"
Ok "Node.js: $(node --version)"

# ============================================================
# 3. pnpm
# ============================================================
Inf "Instalando pnpm..."

if (-not (Has pnpm)) {
    npm install -g pnpm -ErrorAction SilentlyContinue || Die "Falha ao instalar pnpm"
}

Has pnpm || Die "pnpm não instalado"
Ok "pnpm: $(pnpm --version)"

# ============================================================
# 4. Baixar MWCode
# ============================================================
Inf "Baixando MWCode..."

try {
    Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    
    # GitHub CLI ou curl
    if (Has gh) {
        gh repo clone mweslley/mwcode $InstallDir -- --depth 1 2>$null || 
        { git clone --depth 1 https://github.com/mweslley/mwcode.git $InstallDir }
    } else {
        git clone --depth 1 https://github.com/mweslley/mwcode.git $InstallDir -ErrorAction Stop
    }
} catch {
    Die "Falha ao baixar MWCode: $_"
}

Set-Location $InstallDir
Ok "MWCode baixado: $InstallDir"

# ============================================================
# 5. Corrigir bugs
# ============================================================
Inf "Verificando correções..."

if (Select-String -Path "install.sh" -Pattern "mkdir_safe" -Quiet) {
    (Get-Content install.sh) -replace 'mkdir_safe', 'mkdir -p' | Set-Content install.sh
    Ok "Bug install.sh corrigido"
}

Log ""

# ============================================================
# 6. Instalar dependências
# ============================================================
Inf "Instalando dependências..."

try {
    pnpm install -ErrorAction Stop
} catch {
    Die "Falha ao instalar dependências: $_"
}

Ok "Dependências instaladas"

# ============================================================
# 7. Criar .env
# ============================================================
if (-not (Test-Path "$InstallDir\.env")) {
    Copy-Item "$InstallDir\.env.example" "$InstallDir\.env"
    Ok ".env criado"
}

# ============================================================
# 8. Liberar porta no Firewall
# ============================================================
Inf "Liberando porta $Port..."

$regra = Get-NetFirewallRule -DisplayName "MWCode" -ErrorAction SilentlyContinue
if (-not $regra) {
    New-NetFirewallRule -DisplayName "MWCode" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow | Out-Null
    Ok "Porta $Port liberada"
} else {
    Ok "Porta $Port já liberada"
}

Log ""

# ============================================================
# 9. Criar comando no PATH
# ============================================================
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$InstallDir;$userPath", "User")
    Ok "PATH atualizado"
    
    Warn "Reabra o terminal para usar 'mwcode'"
}

Log ""

# ============================================================
# Final
# ============================================================
Log "$GREEN$BOLD🎉 Instalação concluída!$RESET"
Log ""
Log "$BOLDPróximos passos:$RESET"
Log "  1. Configure sua chave de API:"
Log "       $YELLOW$InstallDir\.env$RESET"
Log "     (adicione: OPENROUTER_API_KEY=sk-or-v1-...)"
Log ""
Log "  2. Inicie o MWCode:"
Log "       $GREENmwcode$RESET"
Log "     $DIMou$RESET"
Log "       $GREENcd $InstallDir; pnpm dev$RESET"
Log ""
Log "$BOLDAcesso:$RESET"
Log "  UI:    $GREENhttp://localhost:5173$RESET"
Log "  API:   $GREENhttp://localhost:3100$RESET"
Log "  Saúde: $GREENhttp://localhost:3100/api/health$RESET"
Log ""

# Iniciar se solicitado
if ($Start) {
    Log ""
    Log "$CYAN🚀 Iniciando MWCode...$RESET"
    
    Start-Process -FilePath "pnpm" -ArgumentList "dev" -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 5
    
    Ok "MWCode iniciado!"
    Log ""
    Log "Acesse: http://localhost:5173"
    
    # Abrir navegador
    Start-Process "http://localhost:5173"
}