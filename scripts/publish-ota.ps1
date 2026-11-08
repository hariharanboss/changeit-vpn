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

# 3. Create zip package
$zipPath = "release\ChangeIt-v$Version-Windows-x64.zip"
Write-Host ">>> [OTA] Compressing $zipPath..." -ForegroundColor Yellow
Compress-Archive -Path "release\win-unpacked\*" -DestinationPath $zipPath -Force

# 4. Upload to GitHub Releases
$tag = "v$Version"
Write-Host ">>> [OTA] Publishing assets to GitHub Release $tag..." -ForegroundColor Yellow

$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
gh release view $tag 2>$null
$viewExit = $LASTEXITCODE
$ErrorActionPreference = $prevEAP

if ($viewExit -ne 0) {
    gh release create $tag app.asar $zipPath --title "ChangeIt v$Version (In-App Updates & Super-Lean OTA)" --notes "### ChangeIt v$Version`n`n- **Super-Lean Desktop OTA**: Optimized app.asar to ~2.4MB (95% size reduction).`n- **Mobile In-App Updater**: Direct in-app background download with real-time progress bar and native package installer prompt without needing a web browser.`n- **Package Signature Alignment**: Signed with debug keystore to prevent 'Invalid Package' install errors.`n- **Firewall Stealth Tunneling**: Retains port 20091 dokodemo bypass over VLESS 443."
} else {
    gh release upload $tag app.asar $zipPath --clobber
}

Write-Host ">>> [OTA] Successfully published OTA release for $tag!" -ForegroundColor Green

