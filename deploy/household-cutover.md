# Household Cutover Runbook

Operational runbook for deploying the household refactor to production
(CT101 `192.168.1.127`, database on CT110 `192.168.1.115`). It assumes the
household work is merged to `master` locally and `pnpm --filter backend test`
is green.

This is a **one-off**. `backfillHouseholds.ts` runs once per database and is
deliberately not wired into `package.json` — `deploy/update.sh` must never
invoke it. Delete the script once production has run it and settled.

## Executed — 2026-08-30

This cutover ran on 2026-08-30 and succeeded. Deployed commit: `a6aeaee`.
Downtime was 20.5 minutes (service stopped 22:22:36, back up 22:43:08),
nearly all of it `pnpm install` and the build in step 4.

Backfill counts on production, identical between dry run and the real run:
1 household created from the single group, 2 memberships, 0 solo households,
7 categories assigned, no duplicate category names and no override
collisions. Post-migration verification: 1 household, 2 active memberships,
0 null `budget_categories.household_id` out of 7, 489 transactions and
2 users unchanged from the Mongo cutover's recorded figures, and both of
`0002`'s partial unique indexes (`household_members_active_user_uq`,
`transaction_categories_active_uq`) present.

`update.sh` failed at the migrate step exactly as this runbook predicts —
that step is expected to fail and is not a sign anything went wrong.

Note `drizzle.__drizzle_migrations` ids run `1, 3, 4`: id 2 was consumed by
the failed `update.sh` attempt's rolled-back insert. The gap is a sequence
artifact and harmless.

The auto-deploy cron has been restored. Backups retained: CT110
`/mnt/backups/portfolio-pre-household.dump` (99 KB, 13 tables, verified with
`pg_restore --list`) and an off-host copy at
`/home/yor/portfolio-prod-pre-household-2026-08-30.dump`.

**A code-only revert is no longer safe.** Once `0002` applied,
`budget_categories.household_id` is `NOT NULL`, and the pre-household code
inserts categories without one — reverting the commits without also
restoring the dump gives you an app that 500s on category creation. See
Rollback below.

## Why this cannot be a normal deploy

`deploy/update.sh` runs `pnpm run db:migrate` unattended, and the per-minute
auto-deploy cron on CT101 fires it the moment `origin/master` moves. That
does not work here, for two independent reasons:

1. **`0002` needs the backfill to have run.** It ends with
   `ALTER TABLE budget_categories ALTER COLUMN household_id SET NOT NULL`,
   and `0001` adds that column nullable. Rows predating the refactor are null
   until `backfillHouseholds.ts` fills them.

2. **drizzle applies every pending migration in ONE transaction.** With both
   `0001` and `0002` pending, `0002` fails and takes `0001` down with it —
   the database is left completely untouched. Worse, `drizzle-kit migrate`
   swallows the error: it prints `applying migrations...`, exits `1`, and
   says nothing about why. `update.sh` has `set -e`, so the deploy aborts
   *after* `git reset --hard` and the build, leaving new code on disk, the
   old schema in the database, and the service still running the old build
   until something restarts it.

So `0001` has to be applied on its own, with the backfill in between. This
was confirmed locally on 2026-08-30 — the local database sat at `0000` for
exactly this reason, and every household-scoped route 500'd until the
sequence below was run by hand.

## Preconditions

- `pnpm --filter backend test` green locally (31 suites / 315 tests as of
  2026-08-30), plus `pnpm run build` and `pnpm run lint` clean.
- The household work is committed on `master` locally but **not yet pushed**.
- CT101 has disk headroom for a `pnpm install` + build. Its root fs is 3.9 GB
  and was at 79% (792 MB free) on 2026-08-30. Reclaim with `apt clean`,
  `journalctl --vacuum-size=64M`, `pnpm store prune` if it is tighter than
  that, and confirm with `df -h /` before step 4.
- CT101's Node matches `.nvmrc` (`v22.22.2` on 2026-08-30).

## Steps

### 1. Pause the auto-deploy cron

Do this **before** pushing. Master is continuously deployed; if the cron sees
the push before the schema is ready it will run the failing `db:migrate`
described above.

    ssh root@192.168.1.127 'crontab -l > /root/crontab.backup-household && sed "s|^\* \* \* \* \* /opt/portfolio|#&|" /root/crontab.backup-household > /root/crontab.paused'
    ssh root@192.168.1.127 'crontab /root/crontab.paused; crontab -l'

Confirm the `/opt/portfolio` line is commented out before continuing.

### 2. Back up the database

Independently of the nightly cron, and off the box:

CT110 accepts **no direct SSH** — the installer imported only the ed25519 key
and `pg_hba.conf` restricts Postgres to CT101's `/32`. Reach it through the
Proxmox host with `pct exec`, here and everywhere below:

    ssh root@192.168.1.50 'pct exec 110 -- bash -c "sudo -u postgres pg_dump -Fc portfolio > /mnt/backups/portfolio-pre-household.dump"'
    ssh root@192.168.1.50 'pct exec 110 -- ls -la /mnt/backups/portfolio-pre-household.dump'

The bind mount surfaces on the host at `/var/lib/portfolio-backups/`, so the
off-host copy is a plain `scp` from `192.168.1.50`, not from CT110:

    scp root@192.168.1.50:/var/lib/portfolio-backups/portfolio-pre-household.dump ~/

Then copy it somewhere that is not CT110 and not `external-ssd`. This is the
last snapshot before the schema changes; `0002` drops a constraint and adds
two unique indexes, none of which have a down migration.

### 3. Stop the service

The app must not write while the schema is half-migrated. Existing code
inserts `budget_categories` rows with no `household_id`; one such insert
between the backfill and `0002` makes `0002` fail.

    ssh root@192.168.1.127 'systemctl stop portfolio'

### 4. Push and deploy the code

    git push origin master
    ssh root@192.168.1.127 '/opt/portfolio/deploy/update.sh'

**`update.sh` will fail at the migrate step** — that is expected and is the
whole point of this runbook. It fails *atomically*: nothing is applied. The
pull and build before it did succeed, which is what steps 5–7 need. The
service stays stopped because `set -e` aborts before the restart.

### 5. Apply `0001` alone

`drizzle-kit` has no "migrate to a target" flag, so this reads the migration
through drizzle's own `readMigrationFiles` (which is where the recorded hash
comes from — do not hand-compute it) and records it in the same transaction
that applies it. Verify the printed hash for `0000` matches the row already
in `drizzle.__drizzle_migrations` before trusting the rest; that is the check
that proves the hash function matches drizzle's.

Run from `/opt/portfolio/packages/backend` on CT101:

    ssh root@192.168.1.127 'cd /opt/portfolio/packages/backend && cat > /tmp/apply0001.js' <<'EOF'
    require('dotenv').config({ path: '.env' });
    const { readMigrationFiles } = require('drizzle-orm/migrator');
    const { Client } = require('pg');
    (async () => {
      const files = readMigrationFiles({ migrationsFolder: './src/db/migrations' });
      console.log(files.map(f => ({ folder: f.folderMillis, hash: f.hash.slice(0, 12) })));
      const target = files.find(f => f.folderMillis === 1788043380374); // 0001_fat_redwing
      if (!target) throw new Error('0001 not found');
      const c = new Client({ connectionString: process.env.DATABASE_URI });
      await c.connect();
      await c.query('BEGIN');
      try {
        for (const s of target.sql) await c.query(s);
        await c.query(
          'insert into drizzle.__drizzle_migrations (hash, created_at) values ($1,$2)',
          [target.hash, target.folderMillis]
        );
        await c.query('COMMIT');
        console.log('0001 applied and recorded');
      } catch (e) {
        await c.query('ROLLBACK');
        console.log('ERROR:', e.message);
        process.exitCode = 1;
      }
      await c.end();
    })();
    EOF

    ssh root@192.168.1.127 'cd /opt/portfolio/packages/backend && node /tmp/apply0001.js && rm /tmp/apply0001.js'

### 6. Run the backfill

Dry run first, and **read the counts** rather than just checking the exit
code. `householdsCreated` should equal the number of groups,
`membershipsCreated` the number of group members, `soloHouseholdsCreated` the
number of users in no group, and `categoriesAssigned` the total
`budget_categories` row count. `duplicateCategoryNames` and
`overrideCollisions` must both be empty — a non-empty
`overrideCollisions` means `0002`'s `bco_category_month_year_uq` will fail in
step 7, and needs resolving in the data first.

    ssh root@192.168.1.127 'cd /opt/portfolio/packages/backend && npx ts-node -r tsconfig-paths/register src/scripts/backfillHouseholds.ts --dry-run'

Then for real. It is idempotent, so a re-run is safe:

    ssh root@192.168.1.127 'cd /opt/portfolio/packages/backend && npx ts-node -r tsconfig-paths/register src/scripts/backfillHouseholds.ts'

### 7. Apply `0002` and start the service

Now only `0002` is pending, so the normal path works:

    ssh root@192.168.1.127 'cd /opt/portfolio/packages/backend && pnpm run db:migrate'
    ssh root@192.168.1.127 'systemctl start portfolio && systemctl is-active portfolio'

### 8. Smoke test

    ssh root@192.168.1.127 'journalctl -u portfolio -n 40 --no-pager'

Then log in through the app and confirm, for a user who was in a group and a
user who was not: the budget summary loads, transactions load, and
`GET /households` returns one household with the expected members.

Confirm no nulls remain:

    ssh root@192.168.1.50 'pct exec 110 -- sudo -u postgres psql -tA portfolio -c "select count(*) filter (where household_id is null) as nulls, count(*) from budget_categories"'

### 9. Restore the cron

Only after step 8 passes:

    ssh root@192.168.1.127 'crontab /root/crontab.backup-household; crontab -l'

## Rollback

Before step 5, there is nothing to roll back — the database is untouched.
Revert the push and re-run `update.sh`.

After step 5, restore the dump from step 2:

    ssh root@192.168.1.127 'systemctl stop portfolio'
    ssh root@192.168.1.50 'pct exec 110 -- sudo -u postgres dropdb portfolio'
    ssh root@192.168.1.50 'pct exec 110 -- sudo -u postgres createdb -O portfolio_app portfolio'
    ssh root@192.168.1.50 'pct exec 110 -- sudo -u postgres pg_restore -d portfolio /mnt/backups/portfolio-pre-household.dump'

`dropdb` fails while anything is connected, which is why the service is
stopped first. If it still refuses, the app's pool is the likely holder —
check with `pct exec 110 -- sudo -u postgres psql -tA -c "select count(*)
from pg_stat_activity where datname='portfolio'"`.

Then `git revert` the household commits, push, and run `update.sh`. Anything
users wrote after step 7 is lost — that is why the service stays stopped from
step 3 until step 7.

## After it has settled

- Delete `packages/backend/src/scripts/backfillHouseholds.ts` and its test.
- Consider the orphaned-household cleanup noted in the plan's Wave 6
  follow-ups (archive households left with no active members).
