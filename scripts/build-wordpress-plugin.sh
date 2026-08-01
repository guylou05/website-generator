#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$root/dist" "$stage/sitefoundry-connector"
cp "$root/wordpress-plugin/website-generator-connector/website-generator-connector.php" "$stage/sitefoundry-connector/"
cp "$root/wordpress-plugin/website-generator-connector/uninstall.php" "$stage/sitefoundry-connector/"
cp "$root/wordpress-plugin/website-generator-connector/README.md" "$stage/sitefoundry-connector/"
cp -R "$root/wordpress-plugin/website-generator-connector/includes" "$stage/sitefoundry-connector/"
rm -f "$root/dist/sitefoundry-connector.zip"
(cd "$stage" && zip -qr "$root/dist/sitefoundry-connector.zip" sitefoundry-connector)
echo "Built dist/sitefoundry-connector.zip"
