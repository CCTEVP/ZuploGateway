param(
  [int]$Port = 9000,
  [int]$EditorPort = 9100
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path $PSScriptRoot
Set-Location $repoRoot

$portsToFree = @($Port, $EditorPort) | Select-Object -Unique

$processIds = @(
  foreach ($portToFree in $portsToFree) {
    Get-NetTCPConnection -LocalPort $portToFree -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
  }
) | Where-Object { $_ -and $_ -ne 0 -and $_ -ne $PID } | Select-Object -Unique

if ($processIds.Count -gt 0) {
  Write-Host "Stopping processes using ports $($portsToFree -join ', ')..."

  foreach ($processId in $processIds) {
    try {
      $process = Get-Process -Id $processId -ErrorAction Stop
      Write-Host " - $($process.ProcessName) ($processId)"
      Stop-Process -Id $processId -Force -ErrorAction Stop
    }
    catch {
      Write-Warning ("Failed to stop process {0}: {1}" -f $processId, $_.Exception.Message)
    }
  }
}
else {
  Write-Host "Ports $($portsToFree -join ', ') are already free."
}

Write-Host "Starting local gateway on port $Port with route designer on $EditorPort..."
& npm.cmd run dev
exit $LASTEXITCODE