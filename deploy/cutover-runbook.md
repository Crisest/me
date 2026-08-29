# Cutover Runbook

This is the operational runbook for moving the portfolio app's data store from
MongoDB to Postgres and cutting production traffic over. It assumes every
task in `.superpowers/sdd/2026-08-23-mongo-to-postgres-drizzle/` is merged to
`feat/postgres`, the branch is rebased on `master`, and the Postgres LXC is
already provisioned per `deploy/provision-postgres.md`.

## Executed — 2026-08-29

This cutover ran on 2026-08-29 and succeeded. Deployed commit: `183c01e`.
Downtime was roughly 50 minutes. `etl:verify` passed all 28 checks: every row
count, 13 monthly financial checksums matching to the cent, and both orphan
checks. Migrated: 2 users, 5 banks, 4 accounts, 2 budgets, 2 budget_overrides,
1 group, 2 group_members, 489 transactions, 7 budget_categories, 0 cards,
0 uploads, 0 budget_category_overrides. Production (CT101, 192.168.1.127) now
runs against PostgreSQL 17.11 on CT110 (192.168.1.115), database `portfolio`,
role `portfolio_app`. The auto-deploy cron on CT101 has been re-enabled.

During the cutover, `etl:audit` caught that production budgets stored fixed
costs in an embedded `fixedExpenses` array with no equivalent in the new
schema — budget categories are a newer feature Mongo never had, and the ETL
originally had no mapping for it, which would have silently dropped all 7
entries. It was fixed (commit `183c01e`) by mapping each `fixedExpenses`
entry to a `budget_categories` row with `kind='fixed'` and `plannedAmount`
taken from the entry.

The T-0 steps below reflect the order actually executed, not the order this
document originally specified — see git history if the original ordering is
needed for reference.

## Preconditions — confirm all of these before starting T-1

- Every task 1–28 is merged to `feat/postgres` and the branch is rebased on `master`.
- `pnpm --filter backend test` is green with no ignore patterns (as of this
  writing: 27 suites / 214 tests).
- `pnpm run build` and `pnpm run lint` are clean.
- Task 24's audit reports zero unresolved findings against a **current**
  production Mongo snapshot.
- The Postgres LXC is provisioned per `deploy/provision-postgres.md` and
  `psql --version` on it reports PostgreSQL 17. As built: CT110 `postgresql`
  at `192.168.1.115:5432`, PostgreSQL 17.11, role `portfolio_app` owning
  database `portfolio`, reachable only from `192.168.1.127/32` (CT101).
- CT101 has room to build. Its root fs is 4 GB and was at 92% (331 MB free)
  on 2026-08-26 — `pnpm install` for the Postgres branch will not fit. Reclaim
  first with `apt clean`, `journalctl --vacuum-size=64M`, and
  `pnpm store prune`, and confirm with `df -h /` before T-0 step 6. A build
  that dies on ENOSPC halfway leaves `/opt/portfolio` in a state
  `update.sh` cannot recover from on its own.
- CT101 (`portfolio`, `/opt/portfolio`) has `DATABASE_URI` added to
  `packages/backend/.env`, pointing at the production Postgres role
  (`portfolio_app`), **alongside** the existing `MONGODB_URI` — do not remove
  `MONGODB_URI` yet. Both scripts and the app read config via
  `packages/backend/src/config/env.ts`; the app throws at boot if
  `DATABASE_URI` is unset, and the ETL scripts need `MONGODB_URI` to read the
  source. `DB_POOL_MAX` defaults to 10 if unset.
- CT101's Node is `22.20.0` (matches `.nvmrc`, raised from 22.5.1). Check with
  `ssh root@192.168.1.50 "pct exec 101 -- node -v"`. **`deploy/update.sh` does
  not check this itself** — only `deploy/setup.sh` does, and `update.sh` is
  the script T-0 actually runs. If CT101 is still on 22.5.x, upgrade Node on
  the container by hand before T-0 step 6, or the build/migrate/restart will
  run under the wrong runtime with no warning.
- CT101's per-minute auto-deploy cron must be paused before any push or merge
  to `master`. Master is continuously deployed by default: root's crontab
  runs `/opt/portfolio/deploy/auto-update.sh` every minute, and the moment it
  sees `origin/master` move it runs `update.sh` unattended — which for this
  cutover means `db:migrate` creating the schema on CT110 (currently 0
  tables) and the app restarting against that empty Postgres while Mongo
  still holds the real data and the ETL hasn't run yet. As built: the cron is
  currently paused — the line is commented out in root's crontab on CT101,
  with the original saved at `/root/crontab.backup-cutover` and the paused
  version at `/root/crontab.paused`. It was paused with:
  ```
  ssh root@192.168.1.127 'crontab -l > /root/crontab.backup-cutover && sed "s|^\* \* \* \* \* /opt/portfolio|#&|" /root/crontab.backup-cutover > /root/crontab.paused'
  ssh root@192.168.1.127 'crontab /root/crontab.paused; crontab -l'
  ```
  Confirm `crontab -l` on CT101 shows the `/opt/portfolio` line commented out
  before starting T-1. Restoring it (`crontab /root/crontab.backup-cutover`)
  is a T-0 step, gated on `etl:verify` and the smoke test both passing — see
  T-0 below. Do not restore it any earlier.

## T-1 day — rehearsal

Goal: prove the full load-and-verify path works end to end against a
disposable copy of production data, and measure how long it takes.

1. `mongodump` production to a scratch host:
   ```bash
   mongodump --uri="<production mongo uri>" --out=/scratch/mongo-dump
   ```
2. Restore into a scratch Mongo instance and point a scratch backend
   checkout's `.env` at it:
   ```bash
   mongorestore --uri="<scratch mongo uri>" /scratch/mongo-dump
   ```
   Set `MONGODB_URI=<scratch mongo uri>` and `DATABASE_URI=<scratch postgres
   uri>` in that checkout's `packages/backend/.env`. Run
   `pnpm --filter backend db:migrate` against the scratch Postgres first —
   `etl:load` inserts rows, it does not create schema.
3. ```bash
   pnpm --filter backend etl:audit
   ```
   Exits `0` and prints `AUDIT PASSED: no findings. Safe to proceed to
   etl:load.` only when `findings.length === 0` — that includes `resolve`-
   severity findings, not just `halt` ones. Any finding at all is a non-zero
   exit. If it fails, read every `[HALT]` / `[RESOLVE]` line it printed; each
   needs an explicit decision (fix the source data, or accept and document
   the loss) before touching `etl:load`. Do not skip findings to make the
   rehearsal go faster — the rehearsal's job is to surface exactly this.
4. ```bash
   pnpm --filter backend etl:load
   ```
   `load.ts` runs the **entire load in one Postgres transaction** — every
   table's insert happens inside it, and it also self-checks `read ===
   written` per table before allowing the transaction to commit; a mismatch
   throws and rolls back everything, not just that table. On success it
   prints a `console.table` of `{ read, written }` per collection and exits
   `0` with `LOAD COMPLETE.` On any failure it prints `LOAD FAILED — nothing
   was written.` and exits `1` — there is no partial state to clean up
   either way.

   Before committing to the timed run, you can rehearse the rehearsal itself
   with `pnpm --filter backend etl:load -- --dry-run`, which runs every
   insert and the count checks, then deliberately rolls back and exits `0`
   printing `DRY RUN OK — transaction rolled back, nothing written.` Use it
   to shake out mapping errors without needing to re-restore the scratch
   Postgres between attempts.
5. ```bash
   pnpm --filter backend etl:verify
   ```
   Exits `0` (`VERIFY PASSED: N checks.`) only if every check passed; exits
   `1` (`VERIFY FAILED` — `DO NOT switch traffic.`) otherwise. See
   **"What verify actually proves"** below before you read its output as a
   go/no-go signal — two of its checks cannot fail and are not evidence of a
   correct load.
6. Run `parity.sh` for at least three months of data against both stacks.
   It needs both servers running and a valid `jwt` cookie for each — log in
   through both the scratch Mongo-backed app and the scratch Postgres-backed
   app and copy the cookie values:
   ```bash
   cd packages/backend/src/scripts/etl
   MONGO_URL=http://localhost:3001 PG_URL=http://localhost:3000 \
   MONGO_JWT=<cookie from mongo stack login> PG_JWT=<cookie from postgres stack login> \
   ./parity.sh 6 2026
   ./parity.sh 7 2026
   ./parity.sh 8 2026
   ```
   Each call diffs `/transactions`, `/transactions/insights`,
   `/budget/summary`, and `/groups` for that month/year, after stripping id
   fields that legitimately differ (`id`, `createdBy`, `cardId`,
   `accountId`, `categoryId`, `groupId`). It prints `PARITY OK` per endpoint
   or `PARITY MISMATCH on <path>` and exits `1` on the first mismatch — pick
   three months that between them cover a user with transactions, a group,
   and at least one budget override.
7. Record wall-clock time for steps 4–5 (`etl:load` + `etl:verify` only, not
   the dump/restore or parity check). **That elapsed time is the maintenance
   window you announce for T-0.** Pad it — production step 8 (`etl:audit`
   against live data) also has to run and pass before `etl:load` starts, and
   that's additional downtime the rehearsal's audit-against-a-stale-dump
   doesn't fully represent.

### What `etl:verify` actually proves

`verify.ts` runs three kinds of check. They do not carry equal weight, and
conflating them is the most likely way to misread a green run:

| Check | What it proves | Can it fail? |
|---|---|---|
| Row counts (`count <table>`, one per collection/table pair) | Every source row landed somewhere in the target. Undercounts or overcounts both fail this. | Yes — this is a real data-loss detector. |
| Checksum buckets (`checksum bucket count`, `checksum bucket-N`) | Per-user-per-month `SUM(amount)` on transactions matches, compared as a sorted multiset (Mongo ids don't survive the load, so buckets can't be joined by user id — see the comment in `verify.ts`). Catches a dropped/duplicated transaction, a wrong amount, or a mis-bucketed date. | Yes — this is a real data-loss detector, though a failure only says *a* bucket disagrees, not *whose*. |
| Orphan checks (`orphan check: transactions.created_by -> users`, `orphan check: cards.bank_id -> banks`) | That the schema's `NOT NULL` + foreign-key constraints are in force. | **No.** Both columns are `NOT NULL` with a foreign key in the Drizzle schema, so Postgres physically cannot accept an orphaned row on insert — these queries can only ever return `count=0`. A reviewer confirmed this. **These two are a schema-integrity smoke test, not evidence the data survived the move.** A green result on them tells you the schema is wired correctly; it tells you nothing about whether every transaction made it across. Do not point to a green `orphan check` line as reassurance at 2am — point at the row-count and checksum lines instead. |

If `etl:verify` reports all-pass, the row-count and checksum lines are what
you actually trust. If it reports a failure, look at which category failed:
a row-count or checksum failure means STOP and roll back for real; an orphan
check failing at all would indicate something is deeply wrong with the
schema itself (it should be structurally impossible), not a normal load
problem.

## T-0 — cutover

1. Announce downtime. Include the maintenance-window estimate from T-1 step 7,
   and the "users must log in again" notice below.
2. Stop the app so nothing writes to Mongo from here on:
   ```bash
   ssh root@192.168.1.50 "pct exec 101 -- systemctl stop portfolio"
   ```
3. `mongodump` production. **Retain this independently of the rollback
   plan** — put it somewhere outside CT101 and outside the Postgres LXC, e.g.
   the existing nightly-backup target used by `deploy/provision-postgres.md`'s
   `pg_dump` cron, or another host entirely. This is the last full Mongo
   snapshot before anything changes; keep it regardless of how the cutover
   goes.
4. Pause CT101's per-minute auto-deploy cron, if it isn't already (see the
   precondition above — it should be, but confirm here since this is the
   point of no return for it):
   ```
   ssh root@192.168.1.127 'crontab -l > /root/crontab.backup-cutover && sed "s|^\* \* \* \* \* /opt/portfolio|#&|" /root/crontab.backup-cutover > /root/crontab.paused'
   ssh root@192.168.1.127 'crontab /root/crontab.paused; crontab -l'
   ```
   Confirm the printed crontab shows the `/opt/portfolio` line commented out.
5. Merge `feat/postgres` into `master` and push. (This is a normal git
   operation on whatever machine you have push access from — it does not
   need to happen on CT101.) Master is continuously deployed by default —
   without the previous step, CT101's cron would pick this push up and run
   `update.sh` unattended within a minute, against the still-empty CT110
   database. With the cron paused, this push does nothing on its own; the
   deploy happens explicitly in the next step instead.
6. ```bash
   ssh root@192.168.1.50 "pct exec 101 -- bash /opt/portfolio/deploy/update.sh"
   ```
   Run by hand here only because the auto-deploy cron is paused for the
   cutover window — normally the push in the previous step would have
   triggered this on its own. `update.sh` does, in order: `git fetch` +
   `git reset --hard origin/master`,
   `pnpm install`, `pnpm run common:build`, `pnpm run build`,
   `pnpm --filter backend db:migrate` (via `cd packages/backend && pnpm run
   db:migrate`, i.e. `drizzle-kit migrate` — **never** `drizzle-kit push`
   against this or any environment), then `systemctl restart portfolio`. This
   is the migration that actually creates Postgres's schema — before this
   point CT110 has zero tables; the ETL scripts this deploy brings in under
   `packages/backend/src/scripts/etl/` need that schema in place before
   `etl:audit`/`etl:load` can run against it.
7. `update.sh` ends with `systemctl restart portfolio`, which leaves the app
   live against a Postgres database that has a schema but no data yet. Stop
   it again before anyone can hit it:
   ```bash
   ssh root@192.168.1.50 "pct exec 101 -- systemctl stop portfolio"
   ```
8. Against **live production** (`.env` on CT101 already has both
   `MONGODB_URI` and `DATABASE_URI` set per the precondition above):
   ```bash
   ssh root@192.168.1.50 "pct exec 101 -- bash -c 'cd /opt/portfolio && pnpm --filter backend etl:audit'"
   ```
   If it exits non-zero: **STOP.** Do not proceed to `etl:load`. Restart the
   service (`systemctl start portfolio`) and treat this as an aborted
   cutover, not a rollback — nothing was loaded yet, Mongo is untouched, the
   app just needs to come back up on the stack it was already running.
   Investigate the finding, fix it in Mongo or update the ETL's mapping, and
   reschedule.
9. ```bash
   ssh root@192.168.1.50 "pct exec 101 -- bash -c 'cd /opt/portfolio && pnpm --filter backend etl:load'"
   ```
   Confirm the printed table shows `read === written` for every collection
   and the process exited `0` with `LOAD COMPLETE.` If it exits `1`
   (`LOAD FAILED`), the transaction rolled back — Postgres has nothing from
   this run. Restart the service on the Mongo stack and treat it the same as
   an aborted audit: investigate, do not retry blindly.
10. ```bash
    ssh root@192.168.1.50 "pct exec 101 -- bash -c 'cd /opt/portfolio && pnpm --filter backend etl:verify'"
    ```
    If any check fails: **STOP and roll back** (see below) — do not proceed to
    step 11. Remember the orphan checks can't fail regardless; it's the row
    count and checksum checks that gate this decision (see "What `etl:verify`
    actually proves" above).
11. Start the app, then smoke test against the live URL:
    ```bash
    ssh root@192.168.1.50 "pct exec 101 -- systemctl start portfolio"
    ```
    - Log in with a real account (a fresh login is REQUIRED — see below).
    - Load the transactions list for a month with known data.
    - Load insights for that same month.
    - Load a group the test account belongs to.
    - Run a Plaid sync and confirm it completes without error.

    If any of these fail, treat it as a T-0 failure at this late stage: decide
    between rolling back (before anyone else has logged in and written new
    data) and fixing forward, based on what broke. A cosmetic UI bug is fix-
    forward; missing transactions is roll back.
12. Re-enable CT101's auto-deploy cron — only now that both `etl:verify`
    (step 10) and the smoke test (step 11) have passed:
    ```
    ssh root@192.168.1.127 'crontab /root/crontab.backup-cutover; crontab -l'
    ```
    Confirm `crontab -l` shows the `* * * * * /opt/portfolio/deploy/auto-update.sh`
    line uncommented again. Re-enabling it before `etl:verify` has passed, or
    before the smoke test above is green, reintroduces the exact race this
    pause exists to prevent — do not restore it early to save a step.
13. Announce completion, and repeat the "everyone must log in again" notice
    for anyone who missed the pre-announcement.

## Users must log in again

Every user id changes from a Mongo `ObjectId` to a Postgres `uuid`
(`uuidv7()`, assigned fresh by the ETL's `IdMap` — see
`packages/backend/src/scripts/etl/id-map.ts`). `login` signs `{ userId }`
into the JWT, and after the cutover no existing cookie's `userId` matches any
row in the new `users` table.

Concretely, in `packages/backend/src/modules/auth/auth.middleware.ts`: the
old cookie still verifies against `JWT_SECRET` (that hasn't changed), so
`jwt.verify` succeeds and decodes a 24-character Mongo `ObjectId` string as
`userId`. That string is then compared against a Postgres `uuid` column
(`eq(users.id, id)` in `findUserById`). It is not valid UUID syntax, so
Postgres itself rejects the query — Drizzle throws, and because that call
sits inside `authMiddleware`'s `try` block, it lands in the generic `catch`,
which clears the cookie and returns **401 "Invalid authentication token"**,
not a 404. (The 404 branch — "User not found" — only fires for a
syntactically valid uuid that simply isn't in the table; that's not the path
old cookies take.) Either way the user-facing effect is the same: **everyone
is logged out and must log in again.** This is expected. Communicate it
before the cutover, not as a bug report after it.

## Rollback

Valid only before users resume writing on the Postgres stack — i.e. only
between T-0 step 5 and however far into step 11 you are before real
traffic starts hitting it. Once someone has written new data to Postgres,
rolling back discards it.

1. ```bash
   ssh root@192.168.1.50 "pct exec 101 -- systemctl stop portfolio"
   ```
2. On CT101, go back to the commit immediately before the `feat/postgres`
   merge (the parent of the merge commit on `master`), the same way
   `update.sh` moves forward — a hard reset, not a checkout, so the working
   tree matches exactly and nothing is left detached:
   ```bash
   ssh root@192.168.1.50 "pct exec 101 -- bash -c 'cd /opt/portfolio && git fetch origin && git reset --hard <pre-merge-commit-sha>'"
   ```
3. No `.env` change is needed. `MONGODB_URI` was never removed from
   `packages/backend/.env` — the precondition above adds `DATABASE_URI`
   alongside it, it doesn't replace it. The pre-merge code never reads
   `DATABASE_URI` at all, so leaving it in place is harmless. If you did at
   some point strip `MONGODB_URI` out, put it back before the next step —
   the pre-merge app throws without it.
4. Rebuild and restart on the reverted commit — this needs `common:build`
   too, since the pre-merge `packages/common` output may differ from what's
   currently built:
   ```bash
   ssh root@192.168.1.50 "pct exec 101 -- bash -c 'cd /opt/portfolio && pnpm install && pnpm run common:build && pnpm run build && systemctl start portfolio'"
   ```
5. Smoke test the same four checks from T-0 step 11 against the reverted
   (Mongo) stack.

Mongo was never modified — every ETL script (`audit.ts`, `load.ts`,
`verify.ts`) opens it read-only via the raw driver with
`readPreference=secondaryPreferred` and issues no writes (see
`packages/backend/src/scripts/etl/mongo-source.ts`) — so its data is
byte-identical to what it was at T-0 step 2, when the service stopped. Users
who log in again after a rollback see exactly what they had before the
cutover attempt. Anything written to Postgres between T-0 step 5 and the
moment you stop the service for rollback is lost — that's the whole reason
the rollback window closes as soon as users resume writing.

## Decommissioning Mongo

Not before both of these hold:
- `etl:verify`'s output from the actual cutover has been reviewed by a human
  against the table in "What `etl:verify` actually proves" above, not just
  glanced at for `VERIFY PASSED`.
- The Postgres-backed stack has run cleanly in production for an agreed
  period (pick a number when scheduling T-0; this runbook doesn't set one).

Then:
- Remove the `mongodb` dependency from `packages/backend/package.json`.
- Remove `mongoUri` from `packages/backend/src/config/env.ts` and the
  `MONGODB_URI` line from `packages/backend/.env`.
- Delete `packages/backend/src/scripts/etl/` (`audit.ts`, `load.ts`,
  `verify.ts`, `mongo-source.ts`, `id-map.ts`, `parity.sh`, and their tests)
  and the three `etl:*` entries from `packages/backend/package.json`.
- Take a final `mongodump` before decommissioning the Mongo host itself, and
  keep it somewhere durable — cheap insurance even after Postgres has proven
  itself.
