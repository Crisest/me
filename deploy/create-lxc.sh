#!/usr/bin/env bash
set -euo pipefail

# ─── Styled output helpers ───────────────────────────────────────────────────
RD="\033[01;31m"
GN="\033[1;92m"
BL="\033[36m"
YW="\033[33m"
CL="\033[m"
CM="${GN}✓${CL}"
CROSS="${RD}✗${CL}"

function msg_info() { echo -ne " ${BL}[i]${CL} $1..."; }
function msg_ok()   { echo -e " ${CM} $1"; }
function msg_error(){ echo -e " ${CROSS} $1"; exit 1; }

function header_info() {
  clear
  echo -e "${BL}
  ____            _    __      _ _
 |  _ \ ___  _ __| |_ / _| ___| (_) ___
 | |_) / _ \| '__| __| |_ / _ \ | |/ _ \\
 |  __/ (_) | |  | |_|  _| (_) | | | (_) |
 |_|   \___/|_|   \__|_|  \___/|_|_|\___/
                LXC Provisioner
${CL}"
}

# ─── Validate environment ────────────────────────────────────────────────────
if [[ $(id -u) -ne 0 ]]; then
  msg_error "This script must be run as root"
fi

if ! command -v pct &>/dev/null; then
  msg_error "pct not found — this script must run on a Proxmox host"
fi

header_info

# ─── Configuration ───────────────────────────────────────────────────────────
HOSTNAME="portfolio"
DISK_SIZE="4"
CORE_COUNT="2"
RAM_SIZE="2048"
BRIDGE="vmbr0"

# Auto-detect storage pool
STORAGE=$(pvesm status -content rootdir 2>/dev/null | awk 'NR>1 {print $1}' | head -1)
if [[ -z "$STORAGE" ]]; then
  STORAGE="local-lvm"
fi

# Next available CT ID
CT_ID=$(pvesh get /cluster/nextid)

echo -e "${YW}Default configuration:${CL}"
echo -e "  CT ID:     ${GN}${CT_ID}${CL}"
echo -e "  Hostname:  ${GN}${HOSTNAME}${CL}"
echo -e "  Disk:      ${GN}${DISK_SIZE}GB${CL}"
echo -e "  CPU:       ${GN}${CORE_COUNT} cores${CL}"
echo -e "  RAM:       ${GN}${RAM_SIZE}MiB${CL}"
echo -e "  Bridge:    ${GN}${BRIDGE}${CL}"
echo -e "  Storage:   ${GN}${STORAGE}${CL}"
echo ""

read -rp "Use advanced configuration? (y/N): " ADVANCED
if [[ "${ADVANCED,,}" == "y" ]]; then
  read -rp "  CT ID [${CT_ID}]: " input && CT_ID="${input:-$CT_ID}"
  read -rp "  Hostname [${HOSTNAME}]: " input && HOSTNAME="${input:-$HOSTNAME}"
  read -rp "  Disk size GB [${DISK_SIZE}]: " input && DISK_SIZE="${input:-$DISK_SIZE}"
  read -rp "  CPU cores [${CORE_COUNT}]: " input && CORE_COUNT="${input:-$CORE_COUNT}"
  read -rp "  RAM MiB [${RAM_SIZE}]: " input && RAM_SIZE="${input:-$RAM_SIZE}"
  read -rp "  Bridge [${BRIDGE}]: " input && BRIDGE="${input:-$BRIDGE}"
  read -rp "  Storage [${STORAGE}]: " input && STORAGE="${input:-$STORAGE}"
fi

# ─── Download Debian 12 template ─────────────────────────────────────────────
TEMPLATE="debian-12-standard_12.7-1_amd64.tar.zst"
TEMPLATE_STORAGE="local"
TEMPLATE_PATH="/var/lib/vz/template/cache/${TEMPLATE}"

if [[ ! -f "$TEMPLATE_PATH" ]]; then
  msg_info "Downloading Debian 12 LXC template"
  pveam update &>/dev/null
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE" &>/dev/null
  msg_ok "Downloaded Debian 12 template"
else
  msg_ok "Debian 12 template already available"
fi

# ─── Create container ────────────────────────────────────────────────────────
msg_info "Creating LXC container ${CT_ID}"
pct create "$CT_ID" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}" \
  --hostname "$HOSTNAME" \
  --rootfs "${STORAGE}:${DISK_SIZE}" \
  --cores "$CORE_COUNT" \
  --memory "$RAM_SIZE" \
  --net0 "name=eth0,bridge=${BRIDGE},ip=dhcp" \
  --unprivileged 1 \
  --features nesting=0 \
  --onboot 1 \
  --start 0 &>/dev/null
msg_ok "Created LXC container ${CT_ID}"

# ─── Start container ─────────────────────────────────────────────────────────
msg_info "Starting container"
pct start "$CT_ID"
sleep 3
msg_ok "Container started"

# ─── Push and run setup script ────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

msg_info "Pushing setup script into container"
pct push "$CT_ID" "${SCRIPT_DIR}/setup.sh" /root/setup.sh
pct exec "$CT_ID" -- chmod +x /root/setup.sh
msg_ok "Setup script pushed"

msg_info "Running setup inside container (this may take a few minutes)"
pct exec "$CT_ID" -- bash /root/setup.sh
msg_ok "Setup complete"

# ─── Print access info ───────────────────────────────────────────────────────
CT_IP=$(pct exec "$CT_ID" -- hostname -I | awk '{print $1}')

echo ""
echo -e "${GN}════════════════════════════════════════════${CL}"
echo -e "${GN} Portfolio app deployed successfully!${CL}"
echo -e "${GN}════════════════════════════════════════════${CL}"
echo -e "  Container ID:  ${BL}${CT_ID}${CL}"
echo -e "  IP Address:    ${BL}${CT_IP}${CL}"
echo -e "  Access URL:    ${BL}https://${CT_IP}:3000${CL}"
echo -e "${GN}════════════════════════════════════════════${CL}"
