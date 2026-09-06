[CmdletBinding()]
param(
  [string]$WebsiteRoot = "C:\Apps\101st-Doom-Website",
  [string]$UpdaterEnv = "C:\Migration\101st-Roster\private\website-updater.env",
  [string]$LauncherDirectory = "C:\Launchers",
  [string]$WebsiteTaskName = "101st Doom Website",
  [string]$UpdaterTaskName = "101st Doom Website Updater",
  [switch]$Apply
)

$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Run this script from an elevated PowerShell window."
}

$WebsiteRoot = [IO.Path]::GetFullPath($WebsiteRoot)
$UpdaterEnv = [IO.Path]::GetFullPath($UpdaterEnv)
$LauncherDirectory = [IO.Path]::GetFullPath($LauncherDirectory)
$node = (Get-Command node.exe -ErrorAction Stop).Source

$required = @(
  (Join-Path $WebsiteRoot "package.json"),
  (Join-Path $WebsiteRoot "node_modules\next\dist\bin\next"),
  (Join-Path $WebsiteRoot "scripts\updater\run-website-update.mjs"),
  $UpdaterEnv
)
foreach ($item in $required) {
  if (-not (Test-Path -LiteralPath $item -PathType Leaf)) {
    throw "Required updater file is missing: $item"
  }
}

Write-Host "Website task: $WebsiteTaskName"
Write-Host "Updater task: $UpdaterTaskName"
Write-Host "Website root: $WebsiteRoot"
Write-Host "Updater environment: $UpdaterEnv"
if (-not $Apply) {
  Write-Host "Preview only. Add -Apply to create or replace these two tasks."
  exit 0
}

New-Item -ItemType Directory -Path $LauncherDirectory -Force | Out-Null
$websiteLauncher = Join-Path $LauncherDirectory "start-101st-website-managed.cmd"
$updaterLauncher = Join-Path $LauncherDirectory "run-101st-website-updater.cmd"
$utf8 = New-Object Text.UTF8Encoding($false)

[IO.File]::WriteAllText($websiteLauncher, @"
@echo off
cd /d "$WebsiteRoot"
"$node" "node_modules\next\dist\bin\next" start
"@, $utf8)

[IO.File]::WriteAllText($updaterLauncher, @"
@echo off
cd /d "$WebsiteRoot"
"$node" --env-file="$UpdaterEnv" "scripts\updater\run-website-update.mjs" --cutover
"@, $utf8)

$system = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$websiteAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/d /s /c `"`"$websiteLauncher`"`""
$websiteTrigger = New-ScheduledTaskTrigger -AtStartup
$websiteSettings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -MultipleInstances IgnoreNew `
  -StartWhenAvailable

$updaterAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/d /s /c `"`"$updaterLauncher`"`""
$updaterTrigger = New-ScheduledTaskTrigger `
  -Once `
  -At ((Get-Date).AddMinutes(1)) `
  -RepetitionInterval (New-TimeSpan -Minutes 1) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$updaterSettings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -MultipleInstances IgnoreNew `
  -StartWhenAvailable

Register-ScheduledTask -TaskName $WebsiteTaskName -Action $websiteAction `
  -Trigger $websiteTrigger -Principal $system -Settings $websiteSettings -Force | Out-Null
Register-ScheduledTask -TaskName $UpdaterTaskName -Action $updaterAction `
  -Trigger $updaterTrigger -Principal $system -Settings $updaterSettings -Force | Out-Null

Write-Host "Managed website and updater tasks were registered."
Write-Host "Stop the current interactive website, then run: Start-ScheduledTask -TaskName '$WebsiteTaskName'"

