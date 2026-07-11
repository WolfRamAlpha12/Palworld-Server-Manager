#!/usr/bin/env bash
# Install or update the Palworld host agent from GitHub Releases.
# Usage:
#   curl -fsSL https://github.com/WolfRamAlpha12/Palworld-Server-Manager/releases/latest/download/install.sh | sudo bash
#   AGENT_RELEASE_TAG=v1.0.0 sudo -E bash install.sh
set -euo pipefail

REPO="${AGENT_GITHUB_REPO:-WolfRamAlpha12/Palworld-Server-Manager}"
ASSET_NAME="${AGENT_ASSET_NAME:-agent.mjs}"
INSTALL_DIR="${AGENT_DIR:-/opt/psm-agent}"
INSTALL_PATH="${AGENT_INSTALL_PATH:-${INSTALL_DIR}/agent.mjs}"
RELEASE_TAG="${AGENT_RELEASE_TAG:-}"
UNIT_SRC_NAME="palworld-agent.service"
UNIT_DST="/etc/systemd/system/palworld-agent.service"
SKIP_RESTART="${AGENT_SKIP_RESTART:-0}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

need_cmd curl
need_cmd install
need_cmd systemctl

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required (v22 recommended). Install it first." >&2
  exit 1
fi

api_headers=(-fsSL -H "Accept: application/vnd.github+json" -H "User-Agent: psm-agent-install")

if [[ -n "${RELEASE_TAG}" ]]; then
  api_url="https://api.github.com/repos/${REPO}/releases/tags/${RELEASE_TAG}"
else
  api_url="https://api.github.com/repos/${REPO}/releases/latest"
fi

echo "==> Fetching release metadata from ${api_url}"
release_json="$(curl "${api_headers[@]}" "${api_url}")"
tag_name="$(printf '%s' "${release_json}" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1)"
asset_url="$(printf '%s' "${release_json}" | sed -n "s/.*\"browser_download_url\": *\"\\([^\"]*\\/${ASSET_NAME}\\)\".*/\\1/p" | head -1)"

if [[ -z "${tag_name}" || -z "${asset_url}" ]]; then
  echo "Could not resolve release asset ${ASSET_NAME}." >&2
  echo "Ensure a GitHub Release exists with that asset." >&2
  exit 1
fi

echo "==> Installing agent ${tag_name} → ${INSTALL_PATH}"
mkdir -p "${INSTALL_DIR}"
tmp="$(mktemp "${INSTALL_DIR}/.${ASSET_NAME}.XXXXXX")"
trap 'rm -f "${tmp}"' EXIT
curl -fsSL -H "User-Agent: psm-agent-install" -o "${tmp}" "${asset_url}"
install -m 755 "${tmp}" "${INSTALL_PATH}"
rm -f "${tmp}"
trap - EXIT

# Prefer unit file shipped alongside this script when present (local checkout / release unpack)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNIT_CANDIDATES=(
  "${SCRIPT_DIR}/../systemd/${UNIT_SRC_NAME}"
  "${SCRIPT_DIR}/${UNIT_SRC_NAME}"
  "/tmp/${UNIT_SRC_NAME}"
)

unit_src=""
for candidate in "${UNIT_CANDIDATES[@]}"; do
  if [[ -f "${candidate}" ]]; then
    unit_src="${candidate}"
    break
  fi
done

if [[ -n "${unit_src}" ]]; then
  echo "==> Installing systemd unit from ${unit_src}"
  if [[ -f "${UNIT_DST}" ]]; then
    # Preserve operator-edited Environment= lines by only refreshing ExecStart paths
    # when unit already exists; still copy fresh unit on first install.
    echo "    Unit already exists at ${UNIT_DST} — leaving env customizations in place."
    echo "    Updating WorkingDirectory/ExecStart to bundled agent path..."
    sed -i \
      -e 's|^WorkingDirectory=.*|WorkingDirectory=/opt/psm-agent|' \
      -e 's|^ExecStart=.*|ExecStart=/usr/bin/node /opt/psm-agent/agent.mjs|' \
      "${UNIT_DST}"
  else
    install -m 644 "${unit_src}" "${UNIT_DST}"
  fi
else
  # Download unit from the same release (optional asset) or write a minimal one
  unit_url="$(printf '%s' "${release_json}" | sed -n "s/.*\"browser_download_url\": *\"\\([^\"]*\\/${UNIT_SRC_NAME}\\)\".*/\\1/p" | head -1)"
  if [[ -n "${unit_url}" ]]; then
    echo "==> Downloading systemd unit from release"
    if [[ -f "${UNIT_DST}" ]]; then
      echo "    Unit already exists — updating ExecStart paths only."
      sed -i \
        -e 's|^WorkingDirectory=.*|WorkingDirectory=/opt/psm-agent|' \
        -e 's|^ExecStart=.*|ExecStart=/usr/bin/node /opt/psm-agent/agent.mjs|' \
        "${UNIT_DST}"
    else
      curl -fsSL -H "User-Agent: psm-agent-install" -o "${UNIT_DST}" "${unit_url}"
      chmod 644 "${UNIT_DST}"
    fi
  elif [[ ! -f "${UNIT_DST}" ]]; then
    echo "==> Writing minimal ${UNIT_DST} (edit AGENT_SECRET and paths)"
    cat >"${UNIT_DST}" <<'EOF'
[Unit]
Description=Palworld Server Manager Host Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
Environment=AGENT_PORT=9100
Environment=AGENT_BIND=0.0.0.0
Environment=AGENT_SECRET=change-me
Environment=PALWORLD_SERVICE=palworld.service
Environment=HOME=/home/palworld
Environment=PALWORLD_INSTALL_ROOT=/home/palworld/Steam/steamapps/common/PalServer
Environment=STEAMCMD_PATH=/home/palworld/Steam/steamcmd.sh
WorkingDirectory=/opt/psm-agent
ExecStart=/usr/bin/node /opt/psm-agent/agent.mjs
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=palworld-agent

[Install]
WantedBy=multi-user.target
EOF
    chmod 644 "${UNIT_DST}"
  fi
fi

# Keep a copy of this installer for local re-runs when invoked from a file
if [[ -f "${BASH_SOURCE[0]}" && "${BASH_SOURCE[0]}" != "/dev/stdin" && "${BASH_SOURCE[0]}" != "-" ]]; then
  install -m 755 "${BASH_SOURCE[0]}" "${INSTALL_DIR}/install.sh" 2>/dev/null || true
fi

systemctl daemon-reload
systemctl enable palworld-agent.service >/dev/null 2>&1 || true

if [[ "${SKIP_RESTART}" != "1" ]]; then
  echo "==> Restarting palworld-agent.service"
  systemctl restart palworld-agent.service
  systemctl --no-pager --full status palworld-agent.service || true
fi

echo
echo "Installed ${ASSET_NAME} (${tag_name}) to ${INSTALL_PATH}"
echo "Edit secrets/paths if needed: sudo nano ${UNIT_DST}"
echo "Health check: curl -s -H \"Authorization: Bearer <AGENT_SECRET>\" http://127.0.0.1:9100/health"
