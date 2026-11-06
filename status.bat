@echo off
rem Is the app online all right? Just: status.bat (runs status.ps1 without changing Windows' script setting).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0status.ps1" %*
exit /b %ERRORLEVEL%
