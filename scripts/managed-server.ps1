# Firewell CCG managed server; run once instead of start-firewell.cmd.
# Reads only explicit signed-off release manifest from public LuwnFM/CCGame branch.
# Staging only: verifies immutable approved packages; never replaces a running server.
# Blue/green activation is not implemented. Does not persist passwords.
param([ValidateRange(1,60)][int]$CheckMinutes = 5)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$root = (Resolve-Path $root).Path
$data = Join-Path $root 'data'
New-Item -ItemType Directory -Path $data -Force | Out-Null
$branch = 'codex/initial-rules-core'
$manifestUrl = 'https://raw.githubusercontent.com/LuwnFM/CCGame/' + $branch + '/release.json'
$archiveBase = 'https://github.com/LuwnFM/CCGame/archive/'
$installedMarker = Join-Path $data 'managed-staged-release.txt'
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
  if ($manifest.approved -ne $true) { throw 'Релиз не утверждён.' }
  if ($manifest.commit -notmatch '^[a-f0-9]{40}$') { throw 'Требуется неизменяемый commit SHA.' }
  if ($manifest.archiveSha256 -notmatch '^[a-f0-9]{64}$') { throw 'Требуется SHA-256 архива.' }
  if ($manifest.schemaVersion -ne 1) { throw 'Версия схемы не поддерживается.' }
  return $manifest
}
function Stage-Release($manifest) {
  $releaseId = $manifest.releaseId
  $staging = Join-Path $root 'staged-releases'
  New-Item -ItemType Directory -Path $staging -Force | Out-Null
  $temp = Join-Path $staging ('.prepare-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $temp | Out-Null
  try {
    $zip = Join-Path $temp 'release.zip'
    $url = $archiveBase + $manifest.commit + '.zip'
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing -TimeoutSec 90
    if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.archiveSha256) {
      throw 'Контрольная сумма архива не совпала. Работающий сервер не затронут.'
    }
    Expand-Archive -Path $zip -DestinationPath (Join-Path $temp 'extracted')
    $packages = @(Get-ChildItem (Join-Path $temp 'extracted') -Directory)
    if ($packages.Count -ne 1) { throw 'Некорректная структура архива.' }
    $package = $packages[0]
    foreach ($required in @('src/server.ts','src/core.ts','web/index.html','test/server.test.ts','package.json')) {
      if (-not (Test-Path (Join-Path $package.FullName $required))) { throw "В архиве отсутствует $required" }
    }
    $testLog = Join-Path $temp 'tests.log'
    Push-Location $package.FullName
    try {
      $tests = @(Get-ChildItem 'test/*.test.ts' | ForEach-Object { $_.FullName })
      & $nodePath --experimental-strip-types --test @tests *> $testLog
      if ($LASTEXITCODE -ne 0) { throw 'Тесты кандидата не прошли; переключения не будет.' }
      & $nodePath --check web/app.js
      if ($LASTEXITCODE -ne 0) { throw 'Ошибка синтаксиса клиента.' }
    } finally { Pop-Location }
    $destination = Join-Path $staging $releaseId
    if (Test-Path $destination) { throw 'Каталог релиза уже существует; перезапись запрещена.' }
    Move-Item -Path $package.FullName -Destination $destination
    Copy-Item $testLog (Join-Path $destination 'staging-tests.log')
    $manifest | ConvertTo-Json | Set-Content (Join-Path $destination 'verified-manifest.json') -Encoding UTF8
    Set-Content -Path $installedMarker -Value $releaseId -Encoding UTF8
    Write-Host "Кандидат $releaseId проверен и сохранён отдельно. Живой сервер продолжает работу."
    Write-Warning 'Автоматическое переключение новых матчей пока не реализовано. Кандидат не установлен.'
  } finally { Remove-Item -Recurse -Force $temp -ErrorAction SilentlyContinue }
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
        if ($wanted.releaseId -ne $current) {
          Stage-Release $wanted
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

