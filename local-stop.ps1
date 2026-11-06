# Turns off what local.bat turned on: the API (port 8787), the page (port 8000), with their windows, and the database and
# photo storage in Docker. The quilts and photos in them stay for next time (docker compose stop, not down).
#   .\local-stop.bat
# Only this project's programs are closed: something else on those ports is left as it is, and said so.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Step($text) { Write-Host ''; Write-Host "== $text" -ForegroundColor Cyan }
# what this project runs: the page's server, the API in development (npm, node --watch, the window local.bat opened)
$ours = 'http\.server 8000|run dev -w @quilt/server|src[\\/]server\.js'

$procs = @{}
Get-CimInstance Win32_Process | ForEach-Object { $procs[[int]$_.ProcessId] = $_ }
# the outermost of this project's programs around one: its window too, but not a terminal of the person's own
function Root($id) {
  $p = $procs[[int]$id]
  while ($p -and $procs[[int]$p.ParentProcessId] -and $procs[[int]$p.ParentProcessId].CommandLine -match $ours) {
    $p = $procs[[int]$p.ParentProcessId]
  }
  $p
}

foreach ($port in 8787, 8000) {
  $name = @{ 8787 = 'o servidor (API)'; 8000 = 'a página' }[$port]
  Step "Desligando $name"
  $owners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
  if (-not $owners) { Write-Host 'Não estava rodando.'; continue }
  foreach ($id in $owners) {
    $p = $procs[[int]$id]
    if ($p -and -not $p.CommandLine) {
      # Windows hides the command of a program opened as administrator from one that isn't
      Write-Host "Não consegui ver qual programa está na porta $port ($($p.Name), número $id): talvez tenha sido aberto como administrador. Feche a janela dele, ou rode este script como administrador." -ForegroundColor Yellow
      continue
    }
    if (-not $p -or $p.CommandLine -notmatch $ours) {
      Write-Host "A porta $port é de outro programa ($($p.Name)): deixei como está." -ForegroundColor Yellow
      continue
    }
    $root = Root $id
    & taskkill /PID $root.ProcessId /T /F *> $null
    Write-Host 'Desligado.' -ForegroundColor Green
  }
}

Step 'Desligando o banco de dados e o armazenamento de fotos (Docker)'
& docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'O Docker não está rodando: nada a desligar.'
} else {
  & docker compose -p quilt-designer stop
  if ($LASTEXITCODE -ne 0) { Write-Host 'O Docker não conseguiu parar tudo: veja a mensagem acima.' -ForegroundColor Red; exit 1 }
  Write-Host 'Desligados (os quilts e as fotos continuam guardados).' -ForegroundColor Green
}

Write-Host ''
Write-Host 'Pronto: tudo desligado. Para ligar de novo: .\local.bat' -ForegroundColor Green
