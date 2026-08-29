# Provisioning the Postgres LXC

Provisioned as **CT110 `postgresql` at 192.168.1.115:5432**, PostgreSQL 17.11
(PGDG on Debian 13), via the community-scripts ProxmoxVE PostgreSQL script.
This file is both the original recipe and the record of what was actually
applied — if you rebuild, follow it top to bottom.

## Container settings

| Setting | Value | Why |
|---|---|---|
| OS | Debian 13 | Alpine is musl-based and its Postgres collation handling is weaker; the script's Alpine profile also caps RAM/disk too low. Debian matches CT101 so `pg_dump` versions align. |
| Postgres | 17 | Matches `docker-compose.test.yml` and the Testcontainers image in `test/globalSetup.ts`, so migrations and the ETL run in prod against the same major they were tested on. |
| Unprivileged | 1 | Postgres needs no special kernel features. |
| Filesystem mounts feature | none | The `mount=nfs,cifs` feature lets processes inside the container mount filesystems; Postgres never does, and it is the flag that most weakens unprivileged isolation. The backup mount below is a host-side bind mount and does not need it. |
| CPU | 2 | So autovacuum and the ETL do not contend with app connections. |
| RAM | 2048 MB | Allows `shared_buffers=512MB` with page-cache headroom. |
| Disk | 16 GB on `external-ssd` | WAL, index bloat, and on-box `pg_dump` output share this volume. Growing an LXC disk later means downtime. |
| Network | DHCP + router reservation | Equivalent to a static IP as long as the reservation holds. `pg_hba.conf` and `DATABASE_URI` both hardcode the address, so **CT101 needs a reservation too** — if its lease moves, Postgres rejects the app with `no pg_hba.conf entry` while looking perfectly healthy. CT101 also runs a per-minute cron that continuously deploys `master` against this database — see the cron-pause precondition in `deploy/cutover-runbook.md` before merging any schema change. |
| SSH keys | the ed25519 user key only | The installer offers every key in the host's `/root/.ssh`. The `root@proxmox` RSA key is the host's own cluster keypair; root there already has `pct enter`, so importing it only adds a second private key that can reach the database. |
| Adminer | no | It runs on this container and connects over localhost, so it bypasses the `/32` rule below and re-exposes the database as a web login on the LAN. Use `db:studio` over an SSH tunnel, or `pct exec 110 -- sudo -u postgres psql portfolio`. |

Do **not** accept the installer's offer to upgrade the Proxmox host: a new
`pve-kernel` breaks CT104's NVIDIA passthrough until DKMS rebuilds, and the
reboot takes LAN DNS (CT105) and camera recording (CT104) down with it. Upgrade
the host deliberately, on its own, with a `vzdump` first.

## Post-install

The script's defaults are not what this app wants. Harden `pg_hba.conf`
**before** creating the role — the stock config ships
`host all all 0.0.0.0/0 md5`, and the moment a role has a password that rule
makes it reachable from anywhere routable.

`/etc/postgresql/17/main/pg_hba.conf` — delete the `0.0.0.0` lines the script
adds, then scope to the app container only, never the subnet:

    host  portfolio  portfolio_app  192.168.1.127/32  scram-sha-256

Tuning goes in `/etc/postgresql/17/main/conf.d/portfolio.conf` so it survives a
package upgrade rewriting `postgresql.conf`:

    password_encryption = scram-sha-256
    shared_buffers = 512MB
    effective_cache_size = 1536MB   # the script's 4GB default lies to the
                                    # planner about a 2GB container
    work_mem = 16MB
    maintenance_work_mem = 128MB
    max_connections = 50            # app pool is ~10 (DB_POOL_MAX in setup.sh)

`listen_addresses = '*'` and `timezone = 'UTC'` are already correct out of the
box. The UTC setting is deliberate — the date filters have a local-vs-UTC
boundary quirk (spec 5.4) — so verify it rather than assuming, with
`show timezone`.

    systemctl restart postgresql

Then the role and database:

    sudo -u postgres psql <<'SQL'
    CREATE ROLE portfolio_app LOGIN PASSWORD 'REPLACE_ME';
    CREATE DATABASE portfolio OWNER portfolio_app;
    SQL

Verify the parsed rules — this catches a typo that a `grep` of the file will not:

    sudo -u postgres psql -c "select line_number, database, user_name, address, auth_method, error from pg_hba_file_rules"

## Backups

The container's own disk lives on `external-ssd`, so dumps must **not** go
there — that would put the only copy of the financial data on the same physical
drive as the live database. Bind-mount a directory from `local` (the internal
LVM root, a different device) instead. Bind mounts are configured host-side and
need no container feature flag:

    mkdir -p /var/lib/portfolio-backups
    chown 100102:100106 /var/lib/portfolio-backups   # uid/gid shifted by 100000
    chmod 750 /var/lib/portfolio-backups
    pct set 110 -mp0 /var/lib/portfolio-backups,mp=/mnt/backups
    pct reboot 110                                   # LXC mountpoints apply on restart

Unprivileged containers shift uid/gid by 100000, so the host directory must be
owned by `100000 + <in-container uid>`. Here `postgres` is uid 102 / gid 106.
If the first cron run fails with permission denied, that is why.

Nightly dump plus retention — `local` sits above 80% full, so the retention
line is not optional:

    0 3 * * *  postgres  pg_dump -Fc portfolio > /mnt/backups/portfolio-$(date +\%F).dump
    30 3 * * * postgres  find /mnt/backups -name 'portfolio-*.dump' -mtime +14 -delete

Both `local` and `external-ssd` are inside the same machine, so this covers a
drive failure and nothing else. Get one copy off the host — theft, a PSU, or a
bad `rm` all defeat everything above. Note `vzdump` writes to
`/mnt/external-ssd/dump/`, so host-level container backups have the
collocation problem too.
