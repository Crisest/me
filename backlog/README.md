# Backlog

Known work that is real but not scheduled. Each item says what it is, why it
matters, and where to start, so it survives being read cold months from now.
Delete an item when it ships — a stale backlog is worse than no backlog.

Ordered roughly by cost of leaving it alone.

---

## 1. Decide whether `groups` survives the household refactor

**Status:** open — worth settling before the next spec is written.

The household refactor (2026-08-30, `a6aeaee`) introduced households
alongside the existing groups rather than replacing them. Both are live:

| | groups | households |
|---|---|---|
| API | `/groups` — `app.ts:96` | `/households` — `app.ts:97` |
| Routes | `/shared`, `/shared/join/:code`, `/shared/:groupId` | `/household`, `/household/join/:code` |
| Frontend | `modules/shared/` | `modules/household/` |
| Tables | `groups`, `group_members` | `households`, `household_members` |

`backfillHouseholds.ts` seeded households *from* groups, so today they agree —
one group, one household, the same two members. **Nothing keeps them in sync
from here.** `joinByCode` in `household.service.ts` touches only
`household_members`; the group services touch only `group_members`. The first
time someone joins through one path, the two models disagree, and no
constraint will surface it.

The sidebar only surfaces Household, so the divergence is close to invisible —
which is exactly why it should be decided deliberately. Any feature touching
"who shares this budget" has to pick a side, and "it depends which page you
came from" is not an answer you want baked into a spec.

Options: retire groups (drop the routes, the module, `modules/shared/`, then
the tables in a later migration); keep groups for something genuinely distinct
from households; or make one a view over the other.

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
