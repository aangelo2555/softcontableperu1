@echo off
cd /d "%~dp0"
git add -A
git commit -m "fix: SAAS middleware parameter injection for SQLite"
git push origin main
pause
