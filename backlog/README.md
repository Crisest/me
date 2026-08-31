# Backlog

Known work that is real but not scheduled. Each item says what it is, why it
matters, and where to start, so it survives being read cold months from now.
Delete an item when it ships — a stale backlog is worse than no backlog.

Ordered roughly by cost of leaving it alone.

---

## 1. Drop the `groups` and `group_members` tables

**Status:** open — code is gone, tables remain.

Groups were retired on 2026-08-30: households are now the only budget-sharing
model. The backend module, the `/groups` routes, the frontend `modules/shared/`,
`groupService`, the `Group` types, and `User.groups` are all deleted, and
`aggregateSpend` no longer carries the legacy `transactions.category_id`
fallback that only group insights relied on.

The two tables are still there, deliberately — dropping them is a one-way
migration and there was no reason to couple it to the code removal.

To finish:

- Generate a migration dropping `groups` and `group_members`.
- `transactions.group_id` references `groups`. Nothing reads it any more, but
  `transaction.mapper.ts:29` still maps it onto the `Transaction` DTO as `''`,
  and `Transaction.groupId` in `packages/common` is still required — drop the
  column, the mapper line, and the DTO field together.
- Remove the now-unused table definitions from `db/schema/` and the barrel, and
  the `groups`/`groupMembers` entries in `schema/relations.ts`.
- `test/helpers/factories.ts` and `db/schema/schema.test.ts` still build group
  rows.

Take a dump first — `group_members` is the only record of who shared a budget
before households existed.

## 2. Delete the household backfill script

**Status:** ready — waiting only on production soak time.

`packages/backend/src/scripts/backfillHouseholds.ts` and its test are one-off
migration tooling. They ran against production on 2026-08-30 and have no
remaining purpose. The script is idempotent so a stray re-run is harmless, but
it is dead code that reads like live code.

`deploy/household-cutover.md` is the record of what it did; that document
should outlive the script.

## 3. Decommission Mongo

**Status:** unblocked — gated on however much soak time you want.

Postgres cutover was 2026-08-29, household refactor 2026-08-30, both clean.
Everything on the decommissioning checklist in `deploy/cutover-runbook.md` is
still pending:

- `mongodb` dependency in `packages/backend/package.json`
- `mongoUri` in `packages/backend/src/config/env.ts:13` and `MONGODB_URI` in
  `packages/backend/.env`
- All of `packages/backend/src/scripts/etl/` — `audit.ts`, `load.ts`,
  `verify.ts`, `mongo-source.ts`, `id-map.ts`, `parity.sh`, and their tests
- The three `etl:*` entries in `packages/backend/package.json`

Take a final `mongodump` and keep it somewhere durable before retiring the
Mongo host itself.

## 4. Get `deploy/auto-update.sh` into the repo

**Status:** open — small, and the exposure is real.

The script driving continuous deployment exists only on CT101 at
`/opt/portfolio/deploy/auto-update.sh` and shows as untracked there. It is not
backed up, not reviewable, and not recoverable if that container is lost —
despite being the thing that decides when production changes.

Every other deploy script (`setup.sh`, `update.sh`, `create-lxc.sh`) is in
`deploy/`. This one should be too.

## 5. Fix the reserved `name` field in the register log line

**Status:** open — one-word fix.

`packages/backend/src/modules/auth/auth.controller.ts:15` logs
`{ email, name }`. `name` is reserved by bunyan for the logger's own name, so
the register line emits `"name":"Dbg"` instead of `"name":"portfolio-api"` —
the record is attributed to the registering user rather than the service, which
breaks filtering by logger name.

Rename the field to `userName`. Check the other `log.*` calls for the same
collision while you are there; `name` is an easy field to pass through.

## 6. Archive households left with no active members

**Status:** open — no orphans exist yet.

Flagged as a Wave 6 follow-up in
`docs/superpowers/plans/2026-08-29-household-budget.md`. `leaveHousehold` can
leave a household with zero active members;
`closeActiveMembershipAndArchiveIfEmpty` handles the paths that go through it,
but there is no sweep for households that end up orphaned another way.

Production currently has 1 household with 2 active members, so nothing is
orphaned today. Worth a small script or a step folded into an existing one.
