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
CERT_DIR="${APP_DIR}/certs"

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
if ! command -v node &>/dev/null; then
  msg_info "Installing Node.js v22 LTS"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - &>/dev/null
  apt-get install -y -qq nodejs &>/dev/null
  msg_ok "Node.js $(node -v) installed"
else
  msg_ok "Node.js $(node -v) already installed"
fi

# ─── pnpm via corepack ───────────────────────────────────────────────────────
msg_info "Enabling corepack and pnpm"
corepack enable &>/dev/null
corepack prepare pnpm@latest --activate &>/dev/null
msg_ok "pnpm $(pnpm -v) ready"

# ─── MongoDB 8.0 ─────────────────────────────────────────────────────────────
if ! command -v mongod &>/dev/null; then
  msg_info "Installing MongoDB 8.0"
  curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
    gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg
  echo "deb [signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/8.0 main" \
    > /etc/apt/sources.list.d/mongodb-org-8.0.list
  apt-get update -qq &>/dev/null
  apt-get install -y -qq mongodb-org &>/dev/null
  systemctl daemon-reload
  systemctl enable mongod &>/dev/null
  systemctl start mongod
  msg_ok "MongoDB 8.0 installed and running"
else
  msg_ok "MongoDB already installed"
  systemctl is-active --quiet mongod || systemctl start mongod
fi

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

msg_info "Writing production .env"
cat > "${APP_DIR}/packages/backend/.env" <<EOF
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/portfolio
JWT_SECRET=${JWT_SECRET}
FRONTEND_URL=https://${LXC_IP}
VITE_API_URL=
SSL_CERT_PATH=${CERT_DIR}/cert.pem
SSL_KEY_PATH=${CERT_DIR}/key.pem
EOF
msg_ok "Production .env written"

# ─── Build ────────────────────────────────────────────────────────────────────
msg_info "Building application"
cd "$APP_DIR"
pnpm run common:build &>/dev/null
pnpm run build &>/dev/null
msg_ok "Application built"

# ─── Self-signed TLS certificates ────────────────────────────────────────────
msg_info "Generating self-signed TLS certificates"
mkdir -p "$CERT_DIR"
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout "${CERT_DIR}/key.pem" \
  -out "${CERT_DIR}/cert.pem" \
  -subj "/CN=${LXC_IP}" &>/dev/null
msg_ok "TLS certificates generated"

# ─── systemd service ─────────────────────────────────────────────────────────
msg_info "Creating systemd service"
cat > /etc/systemd/system/portfolio.service <<EOF
[Unit]
Description=Portfolio App
After=network.target mongod.service

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
echo -e "  Access: ${BL}https://${LXC_IP}:3000${CL}"
