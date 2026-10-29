#!/usr/bin/env bash
# Build personal packages without publishing to upstream channels.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
node_version=$(tr -d '\r\n' < .nvmrc)
local_node="$HOME/.local/node-${node_version}-linux-x64/bin"
if [ -x "$local_node/node" ]; then
  export PATH="$local_node:$PATH"
fi
target="${1:-all}"
case "$target" in
  all|windows|android) ;;
  *) echo "Usage: $0 [all|windows|android]" >&2; exit 2 ;;
esac

if [ "$target" != windows ]; then
  export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"
  export ANDROID_HOME="${ANDROID_HOME:-$HOME/.local/share/chronos-android-sdk}"
  export ANDROID_SDK_ROOT="$ANDROID_HOME"
  signing_env="$HOME/.local/share/chronos-sp/signing/release.env"
  if [ -f "$signing_env" ]; then source "$signing_env"; fi
  : "${RELEASE_KEYSTORE_FILE:?Set RELEASE_KEYSTORE_FILE or restore the Chronos signing directory}"
  : "${RELEASE_KEYSTORE_PASSWORD:?Missing signing password}"
  : "${RELEASE_KEYSTORE_ALIAS:?Missing signing alias}"
  : "${RELEASE_KEY_PASSWORD:?Missing key password}"
  test -f "$RELEASE_KEYSTORE_FILE"
fi

export GITHUB_SHA=$(git rev-parse HEAD)
npm run buildFrontend:prod:es6

if [ "$target" != android ]; then
  npm run electron:build
  npx --no-install electron-builder --config electron-builder.chronos.cjs --win nsis --x64 --publish never
fi
if [ "$target" != windows ]; then
  # Hash-named chunks from older builds must not survive in the Android source.
  node - <<'NODE'
const fs = require('node:fs');
fs.rmSync('dist/browser', { recursive: true, force: true });
fs.cpSync('.tmp/angular-dist/browser', 'dist/browser', { recursive: true });
NODE
  npm run sync:android
  (
    cd android
    ./gradlew assembleFdroidRelease -PchronosLaunchMode=2 --no-daemon --max-workers=4
  )
fi
