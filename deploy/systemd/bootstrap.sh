#!/usr/bin/env bash
# Bootstrap Palworld systemd + host agent on an Ubuntu VM.
# Run from the repo root on the game host (or copy deploy/ + agent build).
set -euo pipefail

USER_NAME="${PALWORLD_USER:-palworld}"
INSTALL_ROOT="${PALWORLD_INSTALL_ROOT:-/home/${USER_NAME}/Steam/steamapps/common/PalServer}"
AGENT_DIR="${AGENT_DIR:-/opt/palworld-agent}"
AGENT_SECRET="${AGENT_SECRET:-$(openssl rand -hex 24)}"
AGENT_PORT="${AGENT_PORT:-9100}"

echo "==> Installing palworld.service"
sudo install -m 644 deploy/systemd/palworld.service /etc/systemd/system/palworld.service
sudo sed -i "s|User=palworld|User=${USER_NAME}|g" /etc/systemd/system/palworld.service
sudo sed -i "s|Group=palworld|Group=${USER_NAME}|g" /etc/systemd/system/palworld.service
sudo sed -i "s|/home/palworld|$(getent passwd "${USER_NAME}" | cut -d: -f6)|g" /etc/systemd/system/palworld.service

if [[ ! -d "${AGENT_DIR}" ]]; then
  echo "==> ${AGENT_DIR} missing — build the agent first:"
  echo "    pnpm install && pnpm --filter @psm/shared build && pnpm --filter @psm/agent build"
  echo "    sudo mkdir -p ${AGENT_DIR} && sudo cp -a apps/agent/dist ${AGENT_DIR}/"
  echo "    sudo cp -a node_modules ${AGENT_DIR}/  # or use a production install"
fi

echo "==> Installing palworld-agent.service"
sudo install -m 644 deploy/systemd/palworld-agent.service /etc/systemd/system/palworld-agent.service
sudo sed -i "s|User=palworld|User=${USER_NAME}|g" /etc/systemd/system/palworld-agent.service
sudo sed -i "s|Group=palworld|Group=${USER_NAME}|g" /etc/systemd/system/palworld-agent.service
sudo sed -i "s|AGENT_SECRET=change-me|AGENT_SECRET=${AGENT_SECRET}|g" /etc/systemd/system/palworld-agent.service
sudo sed -i "s|AGENT_PORT=9100|AGENT_PORT=${AGENT_PORT}|g" /etc/systemd/system/palworld-agent.service
sudo sed -i "s|PALWORLD_INSTALL_ROOT=.*|PALWORLD_INSTALL_ROOT=${INSTALL_ROOT}|g" /etc/systemd/system/palworld-agent.service

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
