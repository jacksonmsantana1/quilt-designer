@echo off
rem Back to an earlier version online (as administrator). Just: rollback.bat (runs rollback.ps1 without changing Windows' script setting).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0rollback.ps1" %*
exit /b %ERRORLEVEL%
