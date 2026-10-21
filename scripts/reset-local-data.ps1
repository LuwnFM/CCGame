# Start with a clean local SQLite state. The previous local data is preserved.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
$data = Join-Path $root 'data'
$archive = Join-Path $root 'local-reset-backups'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$listener = $null
try {
  $listener = [System.Net.Sockets.TcpClient]::new()
  $pending = $listener.BeginConnect('127.0.0.1', 3000, $null, $null)
  if ($pending.AsyncWaitHandle.WaitOne(300)) {
    $listener.EndConnect($pending)
    throw 'Port 3000 is in use. Stop Firewell before resetting its local database.'
  }
} finally { if ($null -ne $listener) { $listener.Dispose() } }
if (Test-Path -LiteralPath $data) {
  New-Item -ItemType Directory -Path $archive -Force | Out-Null
  $destination = Join-Path $archive ("data-before-reset-" + $stamp)
  Move-Item -LiteralPath $data -Destination $destination -ErrorAction Stop
  Write-Host ('Saved previous local data to: ' + $destination)
}
New-Item -ItemType Directory -Path $data -Force | Out-Null
Write-Host 'Local game state is now empty. Accounts, sessions, history, ratings, chat, saved decks and rooms will be fresh.'
Write-Host 'The backup is retained locally. Server and deployed data were not changed.'
