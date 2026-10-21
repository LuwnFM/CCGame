# Firewell CCG managed server; run once instead of start-firewell.cmd.
# Reads only explicit signed-off release manifest from public LuwnFM/CCGame branch.
# Never updates running unfinished PvP games. Does not persist passwords.
param([ValidateRange(1,60)][int]$CheckMinutes = 5)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$root = (Resolve-Path $root).Path
$data = Join-Path $root 'data'
New-Item -ItemType Directory -Path $data -Force | Out-Null
$branch = 'codex/initial-rules-core'
$manifestUrl = 'https://raw.githubusercontent.com/LuwnFM/CCGame/' + $branch + '/release.json'
$archiveUrl = 'https://github.com/LuwnFM/CCGame/archive/refs/heads/' + $branch + '.zip'
$installedMarker = Join-Path $data 'managed-release.txt'
$client = 'https://ccgame-omega.vercel.app'
$env:FIREWELL_DB = Join-Path $data 'firewell.sqlite'
$env:FIREWELL_CLIENT_ORIGIN = $client
$env:PORT = '3000'
$env:FIREWELL_BIND = '127.0.0.1'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Установите Node.js 24+.' }
if ([int]((& node -p 'Number(process.versions.node.split(".")[0])')) -lt 24) { throw 'Нужен Node.js 24+.' }
if (-not $env:FIREWELL_ALPHA_PASSWORD) {
  $env:FIREWELL_ALPHA_PASSWORD = Read-Host 'Общий пароль альфы (10+ символов)'
}
if ($env:FIREWELL_ALPHA_PASSWORD.Length -lt 10) { throw 'Пароль слишком короткий.' }
if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
  throw 'Порт 3000 занят. Сначала завершите предыдущий start-firewell.cmd после матча.'
}
$nodePath = (Get-Command node).Source
function Active-MatchCount {
  if (-not (Test-Path $env:FIREWELL_DB)) { return 0 }
  $code = @'
import { DatabaseSync } from 'node:sqlite';
let count = 0;
let db;
try {
  db = new DatabaseSync(process.argv[1], {readOnly:true});
  const rows = db.prepare("SELECT game FROM rooms WHERE guest IS NOT NULL").all();
  for (const row of rows) {
    const game = JSON.parse(row.game);
    if (!['finished','paused'].includes(game.phase)) count++;
  }
  process.stdout.write(String(count));
} catch(error) {
  console.error(error.message);
  process.exitCode = 2;
} finally { db?.close(); }
'@
  $found = & $nodePath --input-type=module -e $code $env:FIREWELL_DB
  if ($LASTEXITCODE -ne 0) { throw 'Нельзя проверить активные матчи. Обновление отменено.' }
  return [int]$found
}
function Latest-Release {
  $nonce = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $manifest = Invoke-RestMethod -Uri ($manifestUrl + '?t=' + $nonce) -TimeoutSec 20
  if ($manifest.releaseId -notmatch '^firewell-[a-zA-Z0-9._-]{1,48}$') { throw 'Некорректный releaseId.' }
  if ($manifest.branch -ne $branch) { throw 'Несовпадение ветки релиза.' }
  return $manifest.releaseId
}
function Install-Release([string]$releaseId) {
  if ((Active-MatchCount) -gt 0) {
    Write-Host "Обновление $releaseId ждёт завершения всех матчей." -ForegroundColor Yellow
    return $false
  }
  $temp = Join-Path $env:TEMP ('firewell-managed-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $temp | Out-Null
  try {
    $zip = Join-Path $temp 'release.zip'
    Invoke-WebRequest -Uri $archiveUrl -OutFile $zip -UseBasicParsing -TimeoutSec 90
    Expand-Archive -Path $zip -DestinationPath (Join-Path $temp 'extracted')
    $package = Get-ChildItem (Join-Path $temp 'extracted') -Directory | Select-Object -First 1
    if (-not $package) { throw 'Архив пуст.' }
    foreach ($required in @('src/server.ts','src/core.ts','web/index.html','release.json','scripts/managed-server.ps1')) {
      if (-not (Test-Path (Join-Path $package.FullName $required))) { throw "В архиве отсутствует $required" }
    }
    $archiveManifest = Get-Content (Join-Path $package.FullName 'release.json') -Raw | ConvertFrom-Json
    if ($archiveManifest.releaseId -ne $releaseId) { throw 'Релиз изменился во время загрузки; повторим позже.' }
    if ((Active-MatchCount) -gt 0) { return $false }
    # Never touch player SQLite data, archives, secrets or local backups.
    foreach ($directory in @('src','web','scripts')) {
      Copy-Item -Path (Join-Path $package.FullName $directory) -Destination $root -Recurse -Force
    }
    foreach ($file in @('package.json','release.json','vercel.json','start-firewell.cmd')) {
      Copy-Item -Path (Join-Path $package.FullName $file) -Destination (Join-Path $root $file) -Force
    }
    Set-Content -Path $installedMarker -Value $releaseId -Encoding UTF8
    Write-Host "Установлена версия $releaseId; сохранённые данные не затронуты." -ForegroundColor Green
    return $true
  } finally {
    Remove-Item -Recurse -Force $temp -ErrorAction SilentlyContinue
  }
}
function Start-Game {
  $log = Join-Path $data 'managed-server-output.log'
  $errorLog = Join-Path $data 'managed-server-errors.log'
  Write-Host 'Firewell localhost:3000 запущен под управлением менеджера.' -ForegroundColor Green
  return Start-Process -FilePath $nodePath -ArgumentList @('--experimental-strip-types','src/server.ts') -WorkingDirectory $root -PassThru -RedirectStandardOutput $log -RedirectStandardError $errorLog
}
$child = $null
try {
  $lastPoll = [DateTime]::MinValue
  while ($true) {
    if (([DateTime]::UtcNow - $lastPoll).TotalMinutes -ge $CheckMinutes) {
      $lastPoll = [DateTime]::UtcNow
      try {
        $wanted = Latest-Release
        $current = if (Test-Path $installedMarker) { (Get-Content $installedMarker -Raw).Trim() } else { '' }
        if ($wanted -ne $current) {
          if ((Active-MatchCount) -eq 0) {
            if ($child -and -not $child.HasExited) { Stop-Process -Id $child.Id -Force; $child.WaitForExit(); $child=$null }
            Install-Release $wanted | Out-Null
          } else {
            Write-Host "Новый релиз $wanted ожидает окончания игры; текущий сервер продолжает работать."
          }
        }
      } catch { Write-Warning ("Проверка обновления: " + $_.Exception.Message) }
    }
    if (-not $child -or $child.HasExited) {
      try { $child=Start-Game } catch { Write-Warning $_.Exception.Message }
    }
    Start-Sleep -Seconds 15
  }
} finally {
  if ($child -and -not $child.HasExited) { Stop-Process -Id $child.Id -Force }
  Remove-Item Env:FIREWELL_ALPHA_PASSWORD -ErrorAction SilentlyContinue
}
