#!/usr/bin/env bash
# Bootstrap Palworld systemd units on an Ubuntu VM.
# Prefer deploy/agent/install.sh to fetch the bundled agent from GitHub Releases.
# This script installs/configures systemd units and can optionally call install.sh.
set -euo pipefail

USER_NAME="${PALWORLD_USER:-palworld}"
INSTALL_ROOT="${PALWORLD_INSTALL_ROOT:-/home/${USER_NAME}/Steam/steamapps/common/PalServer}"
AGENT_DIR="${AGENT_DIR:-/opt/psm-agent}"
AGENT_SECRET="${AGENT_SECRET:-$(openssl rand -hex 24)}"
AGENT_PORT="${AGENT_PORT:-9100}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "==> Installing palworld.service"
sudo install -m 644 "${SCRIPT_DIR}/palworld.service" /etc/systemd/system/palworld.service
sudo sed -i "s|User=palworld|User=${USER_NAME}|g" /etc/systemd/system/palworld.service
sudo sed -i "s|Group=palworld|Group=${USER_NAME}|g" /etc/systemd/system/palworld.service
HOME_DIR="$(getent passwd "${USER_NAME}" | cut -d: -f6)"
sudo sed -i "s|/home/palworld|${HOME_DIR}|g" /etc/systemd/system/palworld.service

if [[ ! -f "${AGENT_DIR}/agent.mjs" ]]; then
  echo "==> Agent binary missing at ${AGENT_DIR}/agent.mjs"
  if [[ -x "${REPO_ROOT}/deploy/agent/install.sh" ]]; then
    echo "    Running deploy/agent/install.sh..."
    sudo AGENT_DIR="${AGENT_DIR}" AGENT_SKIP_RESTART=1 bash "${REPO_ROOT}/deploy/agent/install.sh"
  else
    echo "    Install with:"
    echo "      curl -fsSL https://github.com/WolfRamAlpha12/Palworld-Server-Manager/releases/latest/download/install.sh | sudo bash"
    exit 1
  fi
fi

echo "==> Installing palworld-agent.service"
sudo install -m 644 "${SCRIPT_DIR}/palworld-agent.service" /etc/systemd/system/palworld-agent.service
sudo sed -i "s|AGENT_SECRET=change-me|AGENT_SECRET=${AGENT_SECRET}|g" /etc/systemd/system/palworld-agent.service
sudo sed -i "s|AGENT_PORT=9100|AGENT_PORT=${AGENT_PORT}|g" /etc/systemd/system/palworld-agent.service
sudo sed -i "s|PALWORLD_INSTALL_ROOT=.*|PALWORLD_INSTALL_ROOT=${INSTALL_ROOT}|g" /etc/systemd/system/palworld-agent.service
sudo sed -i "s|HOME=/home/palworld|HOME=${HOME_DIR}|g" /etc/systemd/system/palworld-agent.service
sudo sed -i "s|STEAMCMD_PATH=/home/palworld/Steam/steamcmd.sh|STEAMCMD_PATH=${HOME_DIR}/Steam/steamcmd.sh|g" /etc/systemd/system/palworld-agent.service

# Ensure settings dir exists; copy default INI if present
SETTINGS_DIR="${INSTALL_ROOT}/Pal/Saved/Config/LinuxServer"
SETTINGS_FILE="${SETTINGS_DIR}/PalWorldSettings.ini"
DEFAULT_FILE="${INSTALL_ROOT}/DefaultPalWorldSettings.ini"
if [[ -f "${DEFAULT_FILE}" && ! -f "${SETTINGS_FILE}" ]]; then
  echo "==> Copying DefaultPalWorldSettings.ini → PalWorldSettings.ini"
  sudo -u "${USER_NAME}" mkdir -p "${SETTINGS_DIR}"
  sudo -u "${USER_NAME}" cp "${DEFAULT_FILE}" "${SETTINGS_FILE}"
fi

sudo systemctl daemon-reload
sudo systemctl enable palworld.service palworld-agent.service
echo
echo "Agent secret (save this in the manager profile): ${AGENT_SECRET}"
echo "Start with: sudo systemctl start palworld-agent.service"
echo "Optional game start: sudo systemctl start palworld.service"
