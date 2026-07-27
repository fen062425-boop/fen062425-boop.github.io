@echo off
setlocal

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local-editor.ps1"

if errorlevel 1 (
  echo.
  echo Local editor failed to start.
  echo Run "pnpm.cmd install" in this folder, then try again.
  pause
)
