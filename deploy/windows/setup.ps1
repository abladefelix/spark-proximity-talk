# SKANAROUND — one-time Windows VPS setup
# Run in an elevated PowerShell (Run as Administrator):
#   Set-ExecutionPolicy Bypass -Scope Process -Force; .\deploy\windows\setup.ps1

param(
  [string]$AppDir  = "C:\apps\skanaround",
  [string]$RepoUrl = "https://github.com/<your-org>/<your-repo>.git",
  [string]$Branch  = "main"
)

$ErrorActionPreference = "Stop"

function Install-IfMissing($id, $probe) {
  if (Get-Command $probe -ErrorAction SilentlyContinue) {
    Write-Host "$probe already installed"; return
  }
  Write-Host "Installing $id ..."
  winget install --id $id -e --accept-source-agreements --accept-package-agreements
}

# 1. Tooling
Install-IfMissing "OpenJS.NodeJS.LTS" "node"
Install-IfMissing "Git.Git"           "git"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path", "User")

# 2. Source checkout
if (-not (Test-Path $AppDir)) {
  git clone --branch $Branch $RepoUrl $AppDir
} else {
  Write-Host "$AppDir already exists — skipping clone"
}
Set-Location $AppDir

# 3. Environment file (never committed)
if (-not (Test-Path "$AppDir\.env")) {
  Copy-Item "$AppDir\.env.example" "$AppDir\.env"
  Write-Warning "Created .env from .env.example — fill in the values before starting."
}

# 4. Process manager: PM2 + Windows service wrapper
npm install -g pm2 pm2-windows-startup
pm2-startup install

# 5. First build + start
npm install
npm run build
pm2 start "$AppDir\ecosystem.config.cjs"
pm2 save

Write-Host ""
Write-Host "App is running on http://127.0.0.1:3000"
Write-Host "Next: put IIS (deploy/windows/web.config) or Caddy (deploy/windows/Caddyfile) in front for HTTPS on skanaround.bytenetdigital.com"
