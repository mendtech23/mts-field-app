param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"

$AppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppPort = 5178
$RelayPort = 8787
$AppUrl = "http://localhost:$AppPort/index.html"
$RelayHealthUrl = "http://localhost:$RelayPort/health"

$PythonCandidates = @(
  "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe",
  "python",
  "py"
)
$NodeCandidates = @(
  "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe",
  "node"
)

function Resolve-CommandPath($Candidates) {
  foreach ($Candidate in $Candidates) {
    if (Test-Path $Candidate) {
      return $Candidate
    }
    $Found = Get-Command $Candidate -ErrorAction SilentlyContinue
    # Skip the Microsoft Store python stub, which only opens the Store.
    if ($Found -and $Found.Source -notlike "*\WindowsApps\*") {
      return $Found.Source
    }
  }
  return $null
}

function Test-PortListening($Port) {
  return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Wait-ForUrl($Url, $Name, $Seconds = 15) {
  for ($i = 0; $i -lt ($Seconds * 2); $i++) {
    try {
      $null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      Write-Host "$Name is up: $Url"
      return $true
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  Write-Warning "$Name did not respond at $Url"
  return $false
}

if (Test-PortListening $AppPort) {
  Write-Host "App server already running on port $AppPort. Reusing it."
} else {
  $Python = Resolve-CommandPath $PythonCandidates
  if (-not $Python) {
    throw "Python was not found. Install Python 3 or run this where the bundled runtime is available."
  }
  $AppArgs = "-m http.server $AppPort -d `"$AppRoot`""
  Start-Process -FilePath $Python -ArgumentList $AppArgs -WindowStyle Hidden
}

if (Test-PortListening $RelayPort) {
  Write-Host "Relay server already running on port $RelayPort. Reusing it."
} else {
  $Node = Resolve-CommandPath $NodeCandidates
  if (-not $Node) {
    throw "Node.js was not found. Install Node.js 18+ or run this where the bundled runtime is available."
  }
  $RelayArgs = "`"$AppRoot\relay-server.js`""
  Start-Process -FilePath $Node -ArgumentList $RelayArgs -WorkingDirectory $AppRoot -WindowStyle Hidden
}

$AppOk = Wait-ForUrl $AppUrl "MTS app"
$RelayOk = Wait-ForUrl $RelayHealthUrl "Slack relay"

$LanIP = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "169.254*" -and $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -in @("Dhcp", "Manual") } |
  Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "MTS Field Ops started."
Write-Host "App (this PC):        $AppUrl"
if ($LanIP) {
  Write-Host "Phone (same Wi-Fi):   http://${LanIP}:$AppPort/index.html"
}
Write-Host "Relay:                http://localhost:$RelayPort/api/slack/alerts"
Write-Host ""
Write-Host "Stop everything with: .\stop-mts-app.ps1"
Write-Host "If the phone cannot reach the app, allow Python through Windows Firewall for private networks."
Write-Host "For a real phone install (home-screen app, GPS, offline), host the app on an HTTPS domain - see INSTALL.md."

if ($AppOk -and -not $NoBrowser) {
  Start-Process $AppUrl
}
