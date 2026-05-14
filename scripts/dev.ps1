param(
  [int]$BackendPort = 0,
  [int]$FrontendPort = 0,
  [switch]$SkipInstall,
  [switch]$PublicTunnel
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $Root "frontend-web"

if ($BackendPort -eq 0) {
  $BackendPort = if ($env:BACKEND_PORT) { [int]$env:BACKEND_PORT } else { 8000 }
}
if ($FrontendPort -eq 0) {
  $FrontendPort = if ($env:FRONTEND_PORT) { [int]$env:FRONTEND_PORT } else { 5173 }
}

function Invoke-SystemPython {
  param([string[]]$Arguments)

  if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3 @Arguments
    return
  }

  if (Get-Command python -ErrorAction SilentlyContinue) {
    & python @Arguments
    return
  }

  throw "Python 3 was not found. Install Python 3.10+ and try again."
}

function Test-PortAvailable {
  param([int]$Port)

  $Listener = $null
  try {
    $Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
    $Listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    if ($Listener) {
      $Listener.Stop()
    }
  }
}

function Resolve-Port {
  param([int]$PreferredPort)

  if (Test-PortAvailable $PreferredPort) {
    return $PreferredPort
  }

  for ($Port = $PreferredPort + 1; $Port -lt $PreferredPort + 50; $Port++) {
    if (Test-PortAvailable $Port) {
      Write-Host "Port $PreferredPort is busy; using $Port instead."
      return $Port
    }
  }

  throw "No free port found near $PreferredPort."
}

function Resolve-Cloudflared {
  $Existing = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($Existing) {
    return $Existing.Source
  }

  $ToolsDir = Join-Path $Root ".tools"
  $CloudflaredPath = Join-Path $ToolsDir "cloudflared.exe"
  if (Test-Path $CloudflaredPath) {
    return $CloudflaredPath
  }

  New-Item -Path $ToolsDir -ItemType Directory -Force | Out-Null
  $Url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
  Write-Host "Downloading cloudflared for public tunnel..."
  Invoke-WebRequest -Uri $Url -OutFile $CloudflaredPath
  return $CloudflaredPath
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm was not found. Install Node.js 18+ and try again."
}

$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
  Write-Host "Creating Python virtual environment..."
  Invoke-SystemPython @("-m", "venv", (Join-Path $Root ".venv"))
}

if (-not $SkipInstall) {
  $Requirements = Join-Path $Root "requirements.txt"
  $PythonStamp = Join-Path $Root ".venv\.requirements-ready"
  $NeedsPythonInstall = -not (Test-Path $PythonStamp)
  if (-not $NeedsPythonInstall) {
    $NeedsPythonInstall = (Get-Item $Requirements).LastWriteTimeUtc -gt (Get-Item $PythonStamp).LastWriteTimeUtc
  }
  if ($NeedsPythonInstall) {
    Write-Host "Installing backend dependencies..."
    & $VenvPython -m pip install -r $Requirements
    New-Item -Path $PythonStamp -ItemType File -Force | Out-Null
  }

  $NodeModules = Join-Path $FrontendDir "node_modules"
  if (-not (Test-Path $NodeModules)) {
    Write-Host "Installing frontend dependencies..."
    Push-Location $FrontendDir
    try {
      if (Test-Path "package-lock.json") {
        npm ci
      } else {
        npm install
      }
    } finally {
      Pop-Location
    }
  }
}

$BackendPort = Resolve-Port $BackendPort
$FrontendPort = Resolve-Port $FrontendPort

Write-Host ""
Write-Host "Backend:  http://127.0.0.1:$BackendPort"
Write-Host "Frontend: http://localhost:$FrontendPort"
if ($PublicTunnel) {
  Write-Host "Public tunnel mode: open the trycloudflare.com URL printed below."
} else {
  Write-Host "For another device on the same network, open the Network URL printed by Vite."
}
Write-Host ""

$BackendArgs = @("-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "$BackendPort")
$BackendProcess = Start-Process -FilePath $VenvPython -ArgumentList $BackendArgs -WorkingDirectory $Root -PassThru
$FrontendProcess = $null

try {
  Start-Sleep -Seconds 1
  Push-Location $FrontendDir
  try {
    $ViteBin = Join-Path $FrontendDir "node_modules\vite\bin\vite.js"
    if ($PublicTunnel) {
      $env:VITE_API_BASE_URL = "/api"
      $env:VITE_BACKEND_PROXY_TARGET = "http://127.0.0.1:$BackendPort"
      $FrontendProcess = Start-Process -FilePath "node" -ArgumentList @($ViteBin, "--host", "0.0.0.0", "--port", "$FrontendPort") -WorkingDirectory $FrontendDir -PassThru
      Start-Sleep -Seconds 2
      $Cloudflared = Resolve-Cloudflared
      & $Cloudflared tunnel --url "http://127.0.0.1:$FrontendPort"
    } else {
      $env:VITE_API_BASE_URL = ""
      $env:VITE_API_PORT = "$BackendPort"
      & node $ViteBin --host 0.0.0.0 --port $FrontendPort
    }
  } finally {
    Pop-Location
  }
} finally {
  if ($FrontendProcess -and -not $FrontendProcess.HasExited) {
    Stop-Process -Id $FrontendProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($BackendProcess -and -not $BackendProcess.HasExited) {
    Stop-Process -Id $BackendProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
