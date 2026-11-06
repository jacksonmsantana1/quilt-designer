# The app on this computer, to try things before they go online: the latest main, built, with its own database, photo
# storage and API (server/README.md), and the page in the browser.
#   .\local.bat         (-NoPull: keep the code as it is; -NoOpen: don't open the browser)
# The API (http://localhost:8787) and the page (http://localhost:8000/quilt.html) each run in a window of their own:
# closing the window stops it. One already running is left as it is.
param(
  [switch]$NoPull,
  [switch]$NoOpen
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Step($text) { Write-Host ''; Write-Host "== $text" -ForegroundColor Cyan }
function Stop-Here($text) { Write-Host ''; Write-Host "Parei: $text" -ForegroundColor Red; exit 1 }
# a program that fails says so by its exit code, which PowerShell doesn't stop for by itself
function Run($exe) {
  & $exe @args
  if ($LASTEXITCODE -ne 0) { Stop-Here "o comando '$exe $args' falhou (código $LASTEXITCODE)." }
}
function Listening($port) { [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) }

foreach ($tool in 'git', 'npm.cmd', 'docker', 'py') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Stop-Here "não achei o programa '$tool' neste computador." }
}
if (-not (Test-Path 'server\.env')) { Stop-Here 'falta o arquivo server\.env. Copie server\.env.example para server\.env.' }

# ---- 1. the code: the latest main, unless the folder is on another branch or has changes of its own
Step 'Atualizando o código'
$branch = (& git branch --show-current).Trim()
$changed = & git status --porcelain --untracked-files=no
if ($NoPull) {
  Write-Host 'Sem atualizar (-NoPull).'
} elseif ($branch -ne 'main') {
  Write-Host "A pasta está na branch '$branch': fica como está." -ForegroundColor Yellow
} elseif ($changed) {
  Write-Host 'Há mudanças não salvas na pasta: o código fica como está.' -ForegroundColor Yellow
} else {
  Run git pull --ff-only origin main
}
Write-Host "Versão: $((& git log -1 --format='%h %s' HEAD))"

# ---- 2. libraries and the built page
Step 'Instalando as bibliotecas'
Run npm.cmd install --no-audit --no-fund
Step 'Montando o app'
Run npm.cmd run build

# ---- 3. the database and the photo storage, in Docker
Step 'Ligando o banco de dados e o armazenamento de fotos (Docker)'
& docker info *> $null
if ($LASTEXITCODE -ne 0) { Stop-Here 'o Docker não está rodando. Abra o Docker Desktop, espere ele ficar pronto, e rode de novo.' }
Run docker compose -p quilt-designer up -d

# ---- 4. the API, in a window of its own (it adds the database's new tables when it starts)
Step 'Ligando o servidor (API)'
if (Listening 8787) {
  Write-Host 'Já está rodando na porta 8787.'
} else {
  Start-Process powershell -WorkingDirectory $PSScriptRoot -ArgumentList '-NoExit', '-Command', 'npm.cmd run dev -w @quilt/server'
  $ok = $false
  for ($i = 0; $i -lt 30 -and -not $ok; $i++) {
    Start-Sleep -Seconds 1
    try { $ok = [bool](Invoke-RestMethod -UseBasicParsing -TimeoutSec 3 'http://localhost:8787/health').ok } catch {}
  }
  if (-not $ok) { Stop-Here 'o servidor não respondeu em http://localhost:8787/health. Veja a janela dele.' }
}
Write-Host 'Servidor: http://localhost:8787' -ForegroundColor Green

# ---- 5. the page, in a window of its own
Step 'Ligando a página'
if (Listening 8000) {
  Write-Host 'Já está rodando na porta 8000.'
} else {
  Start-Process powershell -WorkingDirectory $PSScriptRoot -ArgumentList '-NoExit', '-Command', 'py -m http.server 8000 --directory app'
  Start-Sleep -Seconds 2
}
$page = 'http://localhost:8000/quilt.html'
Write-Host "Página: $page" -ForegroundColor Green
if (-not $NoOpen) { Start-Process $page }

Write-Host ''
Write-Host 'Pronto. Para parar, feche as janelas do servidor e da página (o Docker pode ficar ligado).' -ForegroundColor Green
