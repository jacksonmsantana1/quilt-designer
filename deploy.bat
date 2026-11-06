@echo off
rem Runs deploy.ps1 without changing Windows' script setting (it blocks .ps1 files by default). Just: deploy.bat
rem (the same parameters work too: -ApiUrl https://... -SentryDsn https://...   -DryRun: only checks)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
exit /b %ERRORLEVEL%
