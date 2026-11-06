@echo off
rem Turns off what local.bat turned on (runs local-stop.ps1 without changing Windows' script setting). Just: local-stop.bat
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0local-stop.ps1" %*
exit /b %ERRORLEVEL%
