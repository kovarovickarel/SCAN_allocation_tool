#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_ROOT"

pause_on_error() {
  status=$?
  echo
  echo "Setup could not finish (exit code ${status})."
  echo "If an installer was just run, restart Windows and double-click start-app.bat again."
  read -r -p "Press Enter to close this window... " _ || true
  exit "$status"
}
trap pause_on_error ERR

add_common_node_paths() {
  local node_dir
  for node_dir in "/c/Program Files/nodejs"; do
    if [[ -d "$node_dir" ]]; then
      PATH="$node_dir:$PATH"
    fi
  done
  if [[ -n "${LOCALAPPDATA:-}" && -d "$LOCALAPPDATA/Programs/nodejs" ]]; then
    PATH="$LOCALAPPDATA/Programs/nodejs:$PATH"
  fi
  if [[ -n "${APPDATA:-}" && -d "$APPDATA/npm" ]]; then
    PATH="$APPDATA/npm:$PATH"
  fi
  export PATH
  hash -r
}

node_is_available() {
  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1
}

node_version_is_supported() {
  node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit((major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22 ? 0 : 1)' >/dev/null 2>&1
}

if ! node_is_available || ! node_version_is_supported; then
  if node_is_available; then
    echo "Node.js $(node --version) is too old for this app. Installing the current LTS release."
  else
    echo "Node.js is required to run this app. Checking for the Windows Package Manager..."
  fi

  if command -v winget.exe >/dev/null 2>&1 || command -v winget >/dev/null 2>&1; then
    echo "Installing the current Node.js LTS release. Windows may ask for permission."
    install_status=0
    if command -v winget.exe >/dev/null 2>&1; then
      winget.exe install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements || install_status=$?
    else
      winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements || install_status=$?
    fi
    add_common_node_paths
    if (( install_status != 0 )); then
      echo "Automatic Node.js installation did not finish. Opening the official download page."
      cmd.exe /c start "" "https://nodejs.org/en/download" || true
      read -r -p "Install the Node.js LTS version, then press Enter... " _ || true
      add_common_node_paths
    fi
  else
    echo "Windows Package Manager was not found, so a compatible Node.js LTS version cannot be installed automatically."
    echo "Install the LTS version from https://nodejs.org/en/download, then run start-app.bat again."
    cmd.exe /c start "" "https://nodejs.org/en/download" || true
    read -r -p "Press Enter after installing Node.js... " _ || true
    add_common_node_paths
  fi
fi

if ! node_is_available || ! node_version_is_supported; then
  echo "A compatible Node.js LTS version is still unavailable. Restart Windows after installation, then run start-app.bat again."
  false
fi

echo "Using Node.js $(node --version)."
echo "Installing the app dependencies. This may take a few minutes the first time."
npx --yes pnpm@10 install --frozen-lockfile

echo
echo "Starting the SCAN Allocation Tool. Your browser will open when the app is ready."
echo "Keep this window open while using the app. Press Ctrl+C here to stop it."
echo
npx --yes pnpm@10 dev -- --open --host 127.0.0.1
