# Forward Windows ports 80/443 into the WSL distro and open the firewall.
# WSL gets a new internal IP on every boot, so run this at startup:
#   Run in an elevated PowerShell:
#     Set-ExecutionPolicy Bypass -Scope Process -Force; .\deploy\windows\wsl-portproxy.ps1
#   Persist it:  the script registers a scheduled task on first run (-Register).

param(
  [int[]]$Ports = @(80, 443),
  [string]$Distro = "Ubuntu-24.04",
  [switch]$Register
)

$ErrorActionPreference = "Stop"

$wslIp = (wsl -d $Distro -- bash -lc "hostname -I | awk '{print `$1}'").Trim()
if (-not $wslIp) { throw "Could not determine the WSL IP for distro '$Distro'." }
Write-Host "WSL IP: $wslIp"

foreach ($port in $Ports) {
  netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 2>$null | Out-Null
  netsh interface portproxy add v4tov4 listenport=$port listenaddress=0.0.0.0 `
    connectport=$port connectaddress=$wslIp | Out-Null

  $ruleName = "WSL SKANAROUND $port"
  if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow `
      -Protocol TCP -LocalPort $port | Out-Null
  }
  Write-Host "Forwarding 0.0.0.0:$port -> ${wslIp}:$port"
}

if ($Register) {
  $script = $MyInvocation.MyCommand.Path
  $action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
  $trigger = New-ScheduledTaskTrigger -AtStartup
  Register-ScheduledTask -TaskName "WSL SKANAROUND port proxy" -Action $action `
    -Trigger $trigger -RunLevel Highest -User "SYSTEM" -Force | Out-Null
  Write-Host "Registered startup task 'WSL SKANAROUND port proxy'."
}
