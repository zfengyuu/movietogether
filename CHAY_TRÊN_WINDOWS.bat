@echo off
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 (
  echo Can cai Node.js 22 truoc: https://nodejs.org/
  pause
  exit /b 1
)
echo Cai dependencies...
call npm install
if errorlevel 1 (
  echo Loi cai packages. Kiem tra ket noi mang va npm registry.
  pause
  exit /b 1
)
echo Mo http://localhost:5173 trong trinh duyet.
call npm run dev
pause
