#!/bin/bash
set -e

SRC="/mnt/c/Users/dhanusha/Desktop/ChangeIt/changeit-desktop"
APPDIR="/tmp/ChangeIt.AppDir"
OUT="$SRC/release/ChangeIt-1.5.9-x86_64.AppImage"
TOOL="$SRC/bin/appimagetool"

mkdir -p "$SRC/bin"
if [ ! -f "$TOOL" ]; then
    echo ">>> Downloading appimagetool..."
    curl -sL -o "$TOOL" https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
    chmod +x "$TOOL"
fi

echo ">>> Packaging ChangeIt AppDir..."
rm -rf "$APPDIR"
mkdir -p "$APPDIR"
cp -r "$SRC/release/linux-unpacked/"* "$APPDIR/"

chmod +x "$APPDIR/changeit"
chmod +x "$APPDIR/bin/xray/xray"

cat > "$APPDIR/AppRun" << 'EOF'
#!/bin/sh
HERE="$(dirname "$(readlink -f "${0}")")"
export PATH="${HERE}/bin:${PATH}"
export LD_LIBRARY_PATH="${HERE}:${LD_LIBRARY_PATH}"
exec "${HERE}/changeit" "$@"
EOF
chmod +x "$APPDIR/AppRun"

cat > "$APPDIR/changeit.desktop" << 'EOF'
[Desktop Entry]
Name=ChangeIt
Comment=Firewall-Resilient Stealth Network Client
Exec=AppRun %U
Terminal=false
Type=Application
Icon=changeit
StartupWMClass=ChangeIt
Categories=Network;Security;
EOF

cp "$SRC/electron/icon.png" "$APPDIR/changeit.png"
cp "$SRC/electron/icon.png" "$APPDIR/.DirIcon"

echo ">>> Building single-file AppImage with appimagetool..."
ARCH=x86_64 "$TOOL" "$APPDIR" "$OUT"

echo ">>> AppImage created successfully:"
ls -lh "$OUT"
