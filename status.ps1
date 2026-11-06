# Is the app online all right? Looks, and changes nothing: the API and its database, the page and which version it is,
# whether main has something not online yet, GitHub's last checks and the nightly backup.
#   .\status.bat        (no administrator needed: it only asks over the internet, as a browser does)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$api = 'https://block-and-bind-api.fly.dev'
$pageUrl = 'https://block-and-bind.pages.dev'
$problems = 0

function Good($text) { Write-Host "  OK  $text" -ForegroundColor Green }
function Bad($text) { Write-Host "  !!  $text" -ForegroundColor Red; $script:problems++ }
function Note($text) { Write-Host "  ..  $text" -ForegroundColor Yellow }
function GitHub($path) { Invoke-RestMethod -UseBasicParsing -TimeoutSec 30 "https://api.github.com/repos/$repo/$path" }
$repo = ((& git remote get-url origin).Trim() -replace '^https://github.com/', '' -replace '\.git$', '')

Write-Host ''
Write-Host "Block & Bind online, $(Get-Date -Format 'dd/MM/yyyy HH:mm')" -ForegroundColor Cyan

# ---- the API: /health asks the database too, which sleeps when nobody uses it (Neon), so a first answer can be slow
# a connection here sometimes drops on its first try (this computer's IPv6 to Fly), so up to three tries
$h = $null
$why = ''
for ($try = 1; $try -le 3 -and -not $h; $try++) {
  $clock = [Diagnostics.Stopwatch]::StartNew()
  try { $h = Invoke-RestMethod -UseBasicParsing -TimeoutSec 60 "$api/health" }
  catch { $why = $_.Exception.Message; Start-Sleep -Seconds 3 }
}
if (-not $h) { Bad "O servidor não respondeu em $api/health ($why)." }
elseif ($h.ok) { Good "Servidor e banco de dados respondem ($([math]::Round($clock.Elapsed.TotalSeconds, 1)) s)." }
else { Bad 'O servidor respondeu, mas sem o banco de dados.' }

# ---- the page, and its version (publish.mjs writes it into the page)
$live = ''
try {
  $page = Invoke-WebRequest -UseBasicParsing -TimeoutSec 30 $pageUrl
  if ($page.Content -match 'RELEASE = setting\("([0-9a-f]{7,})"\)') { $live = $Matches[1] }
  Good "A página abre$(if ($live) { ", versão $live" })."
} catch {
  Bad "A página não abriu em $pageUrl ($($_.Exception.Message))."
}

# ---- what main has that isn't online yet
& git fetch -q origin 2>$null
if ($live) {
  & git cat-file -e "$live^{commit}" 2>$null
  if ($LASTEXITCODE -ne 0) {
    Note "Não conheço a versão $live da página neste computador."
  } else {
    $behind = [int](& git rev-list --count --first-parent "$live..origin/main")
    if ($behind -eq 0) { Good 'O que está no ar é a versão mais nova da main.' }
    else {
      Note "A main tem $behind versão(ões) que ainda não estão no ar (.\deploy.bat publica):"
      & git log --first-parent --format='        %h %s' "$live..origin/main" | Select-Object -First 5 | Write-Host
    }
  }
}

# ---- GitHub's checks of main
try {
  $ci = (GitHub 'actions/runs?branch=main&event=push&per_page=10').workflow_runs |
    Where-Object { $_.name -eq 'CI' } | Select-Object -First 1
  $what = "CI da main ($($ci.head_sha.Substring(0, 7)))"
  if ($ci.status -ne 'completed') { Note "$what ainda rodando: $($ci.html_url)" }
  elseif ($ci.conclusion -eq 'success') { Good "$what verde." }
  else { Bad "$what não passou ($($ci.conclusion)): $($ci.html_url)" }
} catch { Note "Não consegui perguntar ao GitHub sobre o CI ($($_.Exception.Message))." }

# ---- the nightly backup: a run 'skipped' means BACKUPS_ON is not on (backups.bat)
try {
  $b = (GitHub 'actions/workflows/backup.yml/runs?per_page=1').workflow_runs | Select-Object -First 1
  if (-not $b) { Note 'O backup noturno nunca rodou.' }
  elseif ($b.conclusion -eq 'skipped') { Bad 'Backups noturnos desligados (.\backups.bat on liga).' }
  elseif ($b.status -ne 'completed') { Note "Um backup está rodando agora: $($b.html_url)" }
  elseif ($b.conclusion -eq 'success') {
    $when = ([datetime]$b.created_at).ToLocalTime()
    $age = (Get-Date) - $when
    if ($age.TotalHours -gt 30) { Bad "O último backup foi em $($when.ToString('dd/MM HH:mm')), há mais de um dia: $($b.html_url)" }
    else { Good "Último backup em $($when.ToString('dd/MM HH:mm'))." }
  } else { Bad "O último backup falhou ($($b.conclusion)): $($b.html_url)" }
} catch { Note "Não consegui perguntar ao GitHub sobre os backups ($($_.Exception.Message))." }

Write-Host ''
if ($problems) { Write-Host "Atenção: $problems coisa(s) acima precisam de cuidado." -ForegroundColor Red; exit 1 }
Write-Host 'Tudo certo.' -ForegroundColor Green
