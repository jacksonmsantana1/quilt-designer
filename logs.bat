@echo off
rem What the API online is saying (as administrator). Just: logs.bat   (-Recent: the last lines) (runs logs.ps1 without changing Windows' script setting).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0logs.ps1" %*
exit /b %ERRORLEVEL%
