@echo off
echo ========================================
echo DEPLOYMENT: SAAS Middleware Fix
echo ========================================
echo.

echo [1/4] Agregando archivos modificados...
git add server/app.js
git add ROLLBACK_SQLITE.md

echo.
echo [2/4] Creando commit...
git commit -m "fix: SAAS middleware parameter injection for SQLite"

echo.
echo [3/4] Mostrando ultimos commits...
git log --oneline -5

echo.
echo [4/4] Pushing a GitHub...
git push origin main

echo.
echo ========================================
echo DEPLOYMENT COMPLETADO
echo ========================================
echo.
echo Railway auto-desplegara en 2-3 minutos.
echo Monitorea logs en: https://railway.app
echo.
pause
