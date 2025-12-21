@echo off
REM L4 DAR Prototype Validation Script
REM Tests basic functionality and reports status

echo ========================================
echo L4 DAR Prototype - Validation Check
echo ========================================

REM Check if server is running
echo Checking server status...
curl -s http://localhost:8000 >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Server not running on port 8000
    echo Please run start-server.bat first
    goto :error
) else (
    echo ✅ Server running on port 8000
)

REM Check if main files exist
echo Checking file accessibility...
curl -s http://localhost:8000/docs/index.html >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Main application not accessible
    goto :error
) else (
    echo ✅ Main application accessible
)

REM Check if test runner exists
curl -s http://localhost:8000/tests/test-runner.html >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Test runner not accessible
    goto :error
) else (
    echo ✅ Test runner accessible
)

REM Check if core modules exist
curl -s http://localhost:8000/docs/js/modules/constants.js >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Constants module not accessible
    goto :error
) else (
    echo ✅ Constants module accessible
)

curl -s http://localhost:8000/docs/js/modules/physics.js >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Physics module not accessible
    goto :error
) else (
    echo ✅ Physics module accessible
)

echo.
echo ========================================
echo ✅ All basic checks passed!
echo ========================================
echo.
echo Next steps:
echo 1. Open http://localhost:8000/docs/index.html to test the application
echo 2. Open http://localhost:8000/tests/test-runner.html to run automated tests
echo 3. Check browser console for any errors
echo.
goto :end

:error
echo.
echo ========================================
echo ❌ Validation failed!
echo ========================================
echo Please check the issues above and try again.

:end
pause