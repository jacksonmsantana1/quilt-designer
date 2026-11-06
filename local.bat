@echo off
rem The app on this computer (runs local.ps1 without changing Windows' script setting). Just: local.bat
rem (-NoPull: keep the code as it is; -NoOpen: don't open the browser)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0local.ps1" %*
exit /b %ERRORLEVEL%
