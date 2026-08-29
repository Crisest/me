#!/usr/bin/env bash
set -euo pipefail

# ─── Styled output helpers ───────────────────────────────────────────────────
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

# ─── System update ──────────────────────────────────────────────────────────
msg_info "Updating system packages"
apt-get update -qq &>/dev/null
apt-get upgrade -y -qq &>/dev/null
msg_ok "System updated"

# ─── Base packages ───────────────────────────────────────────────────────────
msg_info "Installing base packages"
apt-get install -y -qq curl git openssl gnupg ca-certificates &>/dev/null
msg_ok "Base packages installed"

# ─── Node.js v22 LTS ─────────────────────────────────────────────────────────
# Minimum matches .nvmrc: testcontainers' undici needs worker_threads.markAsUncloneable,
# added after Node 22.7. If an older 22.x is already installed, upgrade it.
REQUIRED_NODE_VERSION="22.20.0"
if command -v node &>/dev/null && \
   printf '%s\n%s\n' "$REQUIRED_NODE_VERSION" "$(node -v | sed 's/^v//')" | sort -C -V; then
  msg_ok "Node.js $(node -v) already installed"
else
  msg_info "Installing Node.js v22 LTS (>= ${REQUIRED_NODE_VERSION})"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - &>/dev/null
  apt-get install -y -qq nodejs &>/dev/null
  msg_ok "Node.js $(node -v) installed"
fi

# ─── pnpm via corepack ───────────────────────────────────────────────────────
msg_info "Enabling corepack and pnpm"
corepack enable &>/dev/null
corepack prepare pnpm@latest --activate &>/dev/null
msg_ok "pnpm $(pnpm -v) ready"

# ─── Clone or pull repository ────────────────────────────────────────────────
if [[ -d "${APP_DIR}/.git" ]]; then
  msg_info "Pulling latest changes"
  cd "$APP_DIR"
  git pull &>/dev/null
  msg_ok "Repository updated"
else
  msg_info "Cloning repository"
  git clone https://github.com/Crisest/me.git "$APP_DIR" &>/dev/null
  cd "$APP_DIR"
  msg_ok "Repository cloned"
fi

# ─── Install dependencies ────────────────────────────────────────────────────
msg_info "Installing dependencies"
cd "$APP_DIR"
pnpm install &>/dev/null
msg_ok "Dependencies installed"

# ─── Generate production .env ─────────────────────────────────────────────────
LXC_IP=$(hostname -I | awk '{print $1}')
JWT_SECRET=$(openssl rand -base64 32)

if [[ -z "${DATABASE_URI:-}" ]]; then
  msg_error "DATABASE_URI must be set (e.g. DATABASE_URI='postgres://portfolio_app:PASS@192.168.1.NNN:5432/portfolio' ./setup.sh)"
  exit 1
fi

msg_info "Writing production .env"
cat > "${APP_DIR}/packages/backend/.env" <<EOF
NODE_ENV=production
DATABASE_URI=${DATABASE_URI}
DB_POOL_MAX=10
JWT_SECRET=${JWT_SECRET}
FRONTEND_URL=http://me.home
VITE_API_URL=
EOF
msg_ok "Production .env written"

# ─── Build ────────────────────────────────────────────────────────────────────
msg_info "Building application"
cd "$APP_DIR"
pnpm run common:build &>/dev/null
pnpm run build &>/dev/null
msg_ok "Application built"

# ─── Database migrations ─────────────────────────────────────────────────────
msg_info "Applying database migrations"
cd "${APP_DIR}/packages/backend" && pnpm run db:migrate
msg_ok "Migrations applied"

# ─── systemd service ─────────────────────────────────────────────────────────
msg_info "Creating systemd service"
cat > /etc/systemd/system/portfolio.service <<EOF
[Unit]
Description=Portfolio App
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}/packages/backend
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable portfolio &>/dev/null
systemctl restart portfolio
msg_ok "Portfolio service started"

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GN}Setup complete!${CL}"
echo -e "  Internal URL: ${BL}http://${LXC_IP}:3000${CL}"
echo -e "  Next: add NPM proxy host me.home → http://${LXC_IP}:3000"
