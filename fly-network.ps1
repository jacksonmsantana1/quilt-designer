# How this computer reaches Fly.io, for deploy.ps1, logs.ps1 and the others: Fly's commands don't connect over the Wi-Fi's
# IPv6 here, so Invoke-Fly turns it off for the command and back on afterwards, also when the command fails or is
# stopped with Ctrl+C. Turning it off needs PowerShell opened as administrator.

$FlyApp = 'block-and-bind-api'

function Test-Admin {
  ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Will Invoke-Fly be able to run? '' when it will, otherwise the reason, in words for the person.
function Test-FlyReady {
  if (-not (Get-Command fly -ErrorAction SilentlyContinue)) { return "não achei o programa 'fly' neste computador." }
  $wifi6 = Get-NetAdapterBinding -Name 'Wi-Fi' -ComponentID ms_tcpip6 -ErrorAction SilentlyContinue
  if ($wifi6 -and $wifi6.Enabled -and -not (Test-Admin)) {
    return 'para falar com o Fly, este computador precisa desligar o IPv6 do Wi-Fi por um momento: abra o PowerShell como administrador e rode de novo.'
  }
  ''
}

# Runs `fly <FlyArgs>`, its output on the screen, and returns its exit code.
function Invoke-Fly([string[]]$FlyArgs) {
  $wifi6 = Get-NetAdapterBinding -Name 'Wi-Fi' -ComponentID ms_tcpip6 -ErrorAction SilentlyContinue
  $turnedOff = $false
  if ($wifi6 -and $wifi6.Enabled) {
    Disable-NetAdapterBinding -Name 'Wi-Fi' -ComponentID ms_tcpip6
    $turnedOff = $true
    Write-Host 'IPv6 do Wi-Fi desligado por enquanto (o Fly não conecta com ele).'
  }
  try {
    & fly @FlyArgs | Out-Host
    $LASTEXITCODE
  } finally {
    if ($turnedOff) {
      Enable-NetAdapterBinding -Name 'Wi-Fi' -ComponentID ms_tcpip6
      Write-Host 'IPv6 do Wi-Fi ligado de novo.'
    }
  }
}
