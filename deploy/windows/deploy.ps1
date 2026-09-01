# SKANAROUND — pull latest from GitHub, rebuild, restart.
# Used manually or by the GitHub Actions self-hosted runner.
#   .\deploy\windows\deploy.ps1

param(
  [string]$AppDir = "C:\apps\skanaround",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"
Set-Location $AppDir

git fetch --all
git reset --hard "origin/$Branch"

npm ci
npm run build

# Restart under PM2 (starts it if it is not running yet)
pm2 startOrReload "$AppDir\ecosystem.config.cjs" --update-env
pm2 save

# Smoke test
Start-Sleep -Seconds 3
$res = Invoke-WebRequest -Uri "http://127.0.0.1:3000/" -UseBasicParsing -TimeoutSec 20
if ($res.StatusCode -ne 200) { throw "Health check failed: $($res.StatusCode)" }
Write-Host "Deployed OK"
