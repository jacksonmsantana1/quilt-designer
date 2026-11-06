@echo off
rem Runs deploy.ps1 without changing Windows' script setting (it blocks .ps1 files by default), with the same
rem parameters:  deploy.bat -ApiUrl https://block-and-bind-api.fly.dev -SentryDsn https://...   (-DryRun: only checks)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
exit /b %ERRORLEVEL%
