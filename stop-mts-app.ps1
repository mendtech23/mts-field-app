$ErrorActionPreference = "SilentlyContinue"

$Ports = 5178, 8787
$Stopped = 0

foreach ($Port in $Ports) {
  $Connections = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
  foreach ($Connection in $Connections | Select-Object -Unique OwningProcess) {
    $ProcessInfo = Get-Process -Id $Connection.OwningProcess -ErrorAction SilentlyContinue
    # Only stop the app's own runtimes; never kill an unrelated process on these ports.
    if ($ProcessInfo -and $ProcessInfo.ProcessName -in @("python", "node")) {
      Write-Host "Stopping $($ProcessInfo.ProcessName) (PID $($ProcessInfo.Id)) on port $Port"
      Stop-Process -Id $ProcessInfo.Id -Force
      $Stopped++
    } elseif ($ProcessInfo) {
      Write-Warning "Port $Port is used by $($ProcessInfo.ProcessName) (PID $($ProcessInfo.Id)), not an MTS server. Leaving it alone."
    }
  }
}

if ($Stopped -eq 0) {
  Write-Host "No MTS Field Ops servers were running."
} else {
  Write-Host "MTS Field Ops stopped."
}
