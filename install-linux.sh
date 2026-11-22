#!/bin/bash
set -e

echo "=========================================="
echo "   ChangeIt VPN - Linux One-Line Installer"
echo "=========================================="

ARCH=$(uname -m)
if [ "$ARCH" != "x86_64" ]; then
    echo "Error: Only x86_64 (64-bit) architecture is currently supported."
    exit 1
fi

LATEST_TAG=$(curl -s https://api.github.com/repos/hariharanboss/changeit-vpn/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
if [ -z "$LATEST_TAG" ]; then
    LATEST_TAG="v1.5.9"
fi
VERSION=${LATEST_TAG#v}

echo ">>> Fetching ChangeIt $LATEST_TAG for Linux..."

if command -v apt-get >/dev/null 2>&1; then
    DEB_URL="https://github.com/hariharanboss/changeit-vpn/releases/download/${LATEST_TAG}/ChangeIt-${VERSION}-amd64.deb"
    TMP_DEB="/tmp/changeit_${VERSION}_amd64.deb"
    
    echo ">>> Downloading Debian package (.deb)..."
    curl -fL -o "$TMP_DEB" "$DEB_URL"
    
    echo ">>> Installing package with sudo apt..."
    sudo apt-get update -qq || true
    sudo apt-get install -y "$TMP_DEB"
    rm -f "$TMP_DEB"
else
    APPIMAGE_URL="https://github.com/hariharanboss/changeit-vpn/releases/download/${LATEST_TAG}/ChangeIt-${VERSION}-x86_64.AppImage"
    INSTALL_DIR="/opt/changeit"
    
    echo ">>> Installing standalone AppImage to /opt/changeit..."
    sudo mkdir -p "$INSTALL_DIR"
    sudo curl -fL -o "$INSTALL_DIR/changeit.AppImage" "$APPIMAGE_URL"
    sudo chmod +x "$INSTALL_DIR/changeit.AppImage"
    sudo ln -sf "$INSTALL_DIR/changeit.AppImage" /usr/local/bin/changeit
    
    sudo mkdir -p /usr/share/icons/hicolor/512x512/apps
    sudo curl -fsSL -o /usr/share/icons/hicolor/512x512/apps/changeit.png https://raw.githubusercontent.com/hariharanboss/changeit-vpn/main/changeit-desktop/electron/icon.png || true
    
    cat << 'EOF' | sudo tee /usr/share/applications/changeit.desktop > /dev/null
[Desktop Entry]
Name=ChangeIt
Comment=Firewall-Resilient Stealth Network Client
Exec=/usr/local/bin/changeit --no-sandbox %U
Terminal=false
Type=Application
Icon=changeit
StartupWMClass=ChangeIt
Categories=Network;Security;
EOF
fi

echo ""
echo "=========================================="
echo "   ChangeIt successfully installed!"
echo "   Launch from your Applications Menu"
echo "   or run 'changeit' in any terminal."
echo "=========================================="
