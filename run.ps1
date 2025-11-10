$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Start-Process -NoNewWindow -FilePath powershell -ArgumentList "-NoExit","-Command","cd server; npm start"
Start-Process -NoNewWindow -FilePath powershell -ArgumentList "-NoExit","-Command","cd client; npm run dev"

Write-Host "Launched server and client."

