@echo off
title Nick's Repair Shop - Local Preview
cd /d "%~dp0"
echo ============================================================
echo   Nick's Repair Shop - starting the local preview
echo ============================================================
echo.
echo Step 1 of 2: Installing files (first run can take 2-5 minutes)...
echo.
call npm install
if errorlevel 1 (
  echo.
  echo *** npm install failed. Is Node.js installed? Take a screenshot of the lines above. ***
  echo.
  pause
  exit /b 1
)
echo.
echo Step 2 of 2: Starting the site...
echo.
echo   When you see:   Local   http://localhost:4321/
echo   open that address in your browser.  Keep THIS window open.
echo   (To stop the preview later: close this window.)
echo.
call npm run dev
pause
