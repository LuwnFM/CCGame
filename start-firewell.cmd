@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Установите Node.js 24 или новее: https://nodejs.org/
  pause
  exit /b 1
)
for /f %%V in ('node -p "Number(process.versions.node.split('.')[0])"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 24 (
  echo Нужен Node.js 24 или новее.
  pause
  exit /b 1
)
if not exist data mkdir data
set "FIREWELL_DB=%CD%\data\firewell.sqlite"
set "PORT=3000"
set "FIREWELL_BIND=127.0.0.1"
echo.
if not defined FIREWELL_ALPHA_PASSWORD (
  echo Введите согласованный общий пароль альфы ^(не менее 10 символов^).
  set /p "FIREWELL_ALPHA_PASSWORD=Пароль допуска: "
)
if "%FIREWELL_ALPHA_PASSWORD:~9,1%"=="" (
  echo Пароль слишком короткий.
  pause
  exit /b 1
)
set /p "LAN=Разрешить вход с телефона в вашей локальной сети? [y/N]: "
if /i "%LAN%"=="y" set "FIREWELL_BIND=0.0.0.0"
set /p "FIREWELL_CLIENT_ORIGIN=Если используете клиент Vercel, его HTTPS-адрес (иначе Enter): "
echo.
echo Сервер и клиент: http://localhost:3000
echo Для телефона используйте http://IP-компьютера:3000 в той же сети.
echo Не закрывайте это окно во время игры.
node scripts/sync-card-catalog.mjs
if errorlevel 1 (
  echo Ошибка каталога карт.
  pause
  exit /b 1
)
node --experimental-strip-types src/server.ts
pause
