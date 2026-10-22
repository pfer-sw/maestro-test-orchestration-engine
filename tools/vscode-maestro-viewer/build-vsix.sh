#!/usr/bin/env bash
# Package and install the extension without vsce: a .vsix is a zip with a manifest.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/extension"
cp "$here/package.json" "$here/extension.js" "$here/README.md" "$tmp/extension/"
cat > "$tmp/[Content_Types].xml" <<'X'
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension=".json" ContentType="application/json"/><Default Extension=".js" ContentType="application/javascript"/><Default Extension=".md" ContentType="text/markdown"/><Default Extension=".vsixmanifest" ContentType="text/xml"/></Types>
X
cat > "$tmp/extension.vsixmanifest" <<'X'
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="maestro-viewer" Version="0.0.1" Publisher="local"/>
    <DisplayName>Maestro Viewer tab</DisplayName>
    <Description xml:space="preserve">Opens the Maestro MCP viewer in a VS Code Simple Browser tab.</Description>
    <Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.75.0"/></Properties>
  </Metadata>
  <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation>
  <Dependencies/>
  <Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/></Assets>
</PackageManifest>
X
out="$tmp/maestro-viewer-0.0.1.vsix"
(cd "$tmp" && zip -qr "$out" "[Content_Types].xml" extension.vsixmanifest extension)
code_bin="$(command -v code || echo "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code")"
"$code_bin" --install-extension "$out" --force
