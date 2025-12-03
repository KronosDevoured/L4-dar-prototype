@echo off
echo Starting L4 DAR Prototype Server...
echo.
echo The server will start on http://localhost:8000
echo.
echo Your browser should open automatically.
echo If not, manually open: http://localhost:8000
echo.
echo Press Ctrl+C to stop the server when you're done.
echo.

cd /d "%~dp0docs"

REM Try Python 3 first
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Using Python to start server...
    start http://localhost:8000
    python -m http.server 8000
    goto :end
)

REM Try Python 2
python -m SimpleHTTPServer 8000 >nul 2>&1
if %errorlevel% == 0 (
    echo Using Python 2 to start server...
    start http://localhost:8000
    python -m SimpleHTTPServer 8000
    goto :end
)

REM If no Python found
echo ERROR: Python is not installed!
echo.
echo Please install Python from: https://www.python.org/downloads/
echo Make sure to check "Add Python to PATH" during installation.
echo.
pause
goto :end

:end
