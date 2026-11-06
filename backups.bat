@echo off
rem The nightly backup: backups.bat [status|on|off|now] (runs backups.ps1 without changing Windows' script setting).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backups.ps1" %*
exit /b %ERRORLEVEL%
