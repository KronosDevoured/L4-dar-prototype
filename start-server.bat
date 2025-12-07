@echo off
echo Starting local server for L4 DAR Prototype...
echo.
cd /d "%~dp0"

REM Start the Python server in the background
start /min python -m http.server 8000

REM Wait a moment for server to start
timeout /t 2 /nobreak >nul

REM Open browser to the prototype
start http://localhost:8000/docs/

echo.
echo Server running at: http://localhost:8000
echo L4 Prototype opened in browser at: http://localhost:8000/docs/
echo.
echo Keep this window open to keep the server running
echo Press any key to stop the server and close this window
pause >nul
