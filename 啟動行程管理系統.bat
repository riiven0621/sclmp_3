@echo off
cd /d "%~dp0"
py "%~dp0start_app.py"
if errorlevel 1 pause
