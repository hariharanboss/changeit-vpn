param(
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"

# Read version from package.json if not specified
if (-not $Version) {
    $pkg = Get-Content package.json | ConvertFrom-Json
    $Version = $pkg.version
}

Write-Host ">>> [OTA] Starting automated OTA build & release for v$Version..." -ForegroundColor Cyan

# A release without the tunnel core is unusable on a fresh machine. Fail loudly.
if (-not (Test-Path "bin\xray\xray.exe")) {
    throw "bin\xray\xray.exe is missing - refusing to build a release the tunnel core cannot run from."
}
if (-not (Test-Path "bin\xray\config.local.json")) {
    throw "bin\xray\config.local.json is missing - the packaged app would have no server config."
}

# 1. Build frontend
Write-Host ">>> [OTA] Building Vite & TypeScript..." -ForegroundColor Yellow
npm run build

# 2. Package lightweight production app.asar (dist, electron, package.json - zero redundant node_modules)
Write-Host ">>> [OTA] Packaging lean app.asar..." -ForegroundColor Yellow
$staging = "build_staging"
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Force -Path $staging | Out-Null
Copy-Item "dist" "$staging\dist" -Recurse -Force
Copy-Item "electron" "$staging\electron" -Recurse -Force
Copy-Item "package.json" "$staging\package.json" -Force
if (Test-Path "config.endpoint.json") {
    Copy-Item "config.endpoint.json" "$staging\config.endpoint.json" -Force
}

New-Item -ItemType Directory -Force -Path "release\win-unpacked\resources" | Out-Null
npx asar pack $staging release\win-unpacked\resources\app.asar
Copy-Item release\win-unpacked\resources\app.asar app.asar -Force
Remove-Item -Recurse -Force $staging

# Update local running instance
$localInstall = "D:\Downloads (Chrome)\ChangeIt-v1.4.7-Windows-x64\resources\app.asar"
if (Test-Path "D:\Downloads (Chrome)\ChangeIt-v1.4.7-Windows-x64\resources") {
    Copy-Item release\win-unpacked\resources\app.asar $localInstall -Force
    Write-Host ">>> [OTA] Local test instance updated!" -ForegroundColor Green
}

# Ensure ChangeIt.exe has the latest icon embedded
$rcedit = "C:\Users\dhanusha\AppData\Local\electron-builder\Cache\winCodeSign\425303339\rcedit-x64.exe"
if (Test-Path $rcedit) {
    & $rcedit "release\win-unpacked\ChangeIt.exe" --set-icon "build\icon.ico" 2>$null
}

# Ensure bin directory (xray, wintun, etc.) is included in release
if (Test-Path "bin") {
    New-Item -ItemType Directory -Force -Path "release\win-unpacked\bin" | Out-Null
    Copy-Item "bin\*" "release\win-unpacked\bin" -Recurse -Force
}

# 3. Create zip package
$zipPath = "release\ChangeIt-v$Version-Windows-x64.zip"
Write-Host ">>> [OTA] Compressing $zipPath..." -ForegroundColor Yellow
Compress-Archive -Path "release\win-unpacked\*" -DestinationPath $zipPath -Force

# Verify the archive really contains a runnable core before publishing it.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $zipPath))
$entries = $zip.Entries | ForEach-Object { $_.FullName -replace '\\', '/' }
$zip.Dispose()
foreach ($required in @('bin/xray/xray.exe', 'bin/xray/config.local.json', 'ChangeIt.exe', 'resources/app.asar')) {
    if (-not ($entries -contains $required)) {
        throw "Release zip is missing $required - aborting publish."
    }
}
Write-Host ">>> [OTA] Zip verification passed (core, config, exe, asar present)." -ForegroundColor Green

# 4. Upload to GitHub Releases
$tag = "v$Version"
Write-Host ">>> [OTA] Publishing assets to GitHub Release $tag..." -ForegroundColor Yellow

$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
gh release view $tag 2>$null
$viewExit = $LASTEXITCODE
$ErrorActionPreference = $prevEAP

if ($viewExit -ne 0) {
    gh release create $tag app.asar $zipPath --title "ChangeIt v$Version (Verified Connect & Real Diagnostics)" --notes "### ChangeIt v$Version`n`n- **Verified connect**: the app now waits for the tunnel core to listen, sends a real probe through it, and only then reports Connected.`n- **Honest failures**: antivirus blocks, missing core files, port conflicts, and unreachable servers are reported with plain-English guidance.`n- **Automatic rollback**: system proxy is restored if the tunnel fails or dies, and stale proxy settings are healed on startup.`n- **Diagnostics panel + logs** at %APPDATA%\\ChangeIt\\logs.`n- **Single-instance lock** prevents two copies from fighting over ports.`n- **Packaging guard**: releases are refused unless the runnable core is included."
} else {
    gh release upload $tag app.asar $zipPath --clobber
}

Write-Host ">>> [OTA] Successfully published OTA release for $tag!" -ForegroundColor Green

