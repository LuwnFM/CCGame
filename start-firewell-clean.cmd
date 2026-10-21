@echo off
setlocal
cd /d "%~dp0"
where powershell >nul 2>nul
if errorlevel 1 (
  echo PowerShell is required for the safe local reset.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\reset-local-data.ps1"
if errorlevel 1 (
  echo Local reset failed. Game was not started.
  pause
  exit /b 1
)
call "%~dp0start-firewell.cmd"
