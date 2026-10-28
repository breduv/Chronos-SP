#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
node_version=$(tr -d '\r\n' < .nvmrc)
local_node="$HOME/.local/node-${node_version}-linux-x64/bin"
if [ -x "$local_node/node" ]; then
  export PATH="$local_node:$PATH"
fi
exec npm run startFrontend:e2e
