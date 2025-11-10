@echo off
setlocal

cd /d %~dp0
start "E2EE-Server" cmd /k "cd server && npm start"
start "E2EE-Client" cmd /k "cd client && npm run dev"

endlocal

