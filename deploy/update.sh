#!/usr/bin/env bash
set -euo pipefail

GN="\033[1;92m"
BL="\033[36m"
RD="\033[01;31m"
CL="\033[m"
CM="${GN}✓${CL}"
CROSS="${RD}✗${CL}"

function msg_info() { echo -ne " ${BL}[i]${CL} $1..."; }
function msg_ok()   { echo -e " ${CM} $1"; }
function msg_error(){ echo -e " ${CROSS} $1"; exit 1; }

APP_DIR="/opt/portfolio"

cd "$APP_DIR" || msg_error "App directory not found"

msg_info "Pulling latest changes"
git pull &>/dev/null
msg_ok "Repository updated"

msg_info "Installing dependencies"
pnpm install &>/dev/null
msg_ok "Dependencies installed"

msg_info "Building application"
pnpm run common:build &>/dev/null
pnpm run build &>/dev/null
msg_ok "Application built"

msg_info "Restarting service"
systemctl restart portfolio
msg_ok "Service restarted"

echo ""
echo -e "${GN}Update complete!${CL}"
