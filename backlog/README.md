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

## 7. Let a household admin sync all members' transactions

**Status:** open — feature request, not started.

Plaid sync today is per-user only: `POST /plaid/sync` and
`POST /plaid/sync/:bankId` (`plaid.routes.ts`) call
`syncAllBanksForUser`/`syncOneBankForUser` (`plaid.service.ts`), both scoped to
`req.user!.id`'s own banks. A household admin has no way to trigger a sync for
a member's banks — each member has to sync their own.

To add it: a household-scoped endpoint (alongside the existing
`household.routes.ts`) that checks the caller is an active admin of the
household (`household.middleware.ts` likely already has the admin check used
elsewhere), then loops over the household's active members' banks calling
`syncBank` per bank the same way `syncAllBanksForUser` does. Aggregate the
`SyncCounts` per member or in total, whichever the frontend needs.

## 8. Budget override inputs don't match the design system

**Status:** open — UX inconsistency, not a bug.

The monthly-override editors in
`packages/frontend/src/components/CategoryRow/CategoryRow.tsx:66-80` and
`packages/frontend/src/components/FixedRow/FixedRow.tsx:70-84` are hand-rolled
— a bare `<input type="number">` and plain `<button>`s for Save/Reset/Cancel.
One component away, `CategoryModal.tsx:1-12,92-116` (the create/edit category
dialog) does this correctly with the shared system components: `YmDialog`,
`YmFlex`, `Textbox` (`@ui/Textbox/Textbox`), `YmCombobox`
(`@ui/YmCombobox/YmCombobox`).

To fix: replace the raw `input`/`button` elements in `CategoryRow` and
`FixedRow` with `Textbox` and the shared button component, matching
`CategoryModal`'s pattern. Backend is unaffected —
`packages/backend/src/modules/budget/budgetCategory.routes.ts:64-75`
(`PUT/DELETE /categories/:id/override`) already does the right thing.

## 9. Insights don't respect the mine/household scope toggle

**Status:** open — feature gap.

The transactions page has a real `'mine' | 'household'` scope toggle
(`packages/frontend/src/components/ScopeToggle/ScopeToggle.tsx`, wired in
`TransactionsPage.tsx:55,59-66,68-79,221-223`) that's passed to both
`useGetTransactionsQuery` and `useGetTransactionInsightsQuery`. But
`aggregateSpend` in `packages/backend/src/modules/shared/insights.query.ts:44-119`
is keyed only on `householdId` + `ownerWindows` — it has no per-user "mine"
filter, so insights always aggregate the whole household regardless of what
the toggle shows for the transaction list underneath it. The budget page
(`BudgetOverviewPage.tsx`) doesn't have the toggle at all, and
`resolveBudgetScope.ts:9-40` is the same story — always household-wide.

To fix: thread the caller's chosen scope into `aggregateSpend` (filter by
owner when `scope === 'mine'`) so insights match what the transactions list is
actually showing. Decide separately whether the budget page should also get
the toggle, or keep budget summaries household-wide by design — the ask above
was specifically about insights matching the transactions view.

## 10. Clicking a category in the budget page should show its transactions

**Status:** open — feature request.

Each budget category row's name is already a clickable button —
`CategoryRow.tsx:54-60` and `FixedRow.tsx:62-68` — but `onEdit`
(`BudgetOverviewPage.tsx:77-80`) opens the edit `CategoryModal`, not a
transactions drilldown. There's no way today to go from "this category is
$140 over budget" to the transactions that make it up.

To add it: add a second affordance on the row (the name button is already
spoken for by edit) that navigates to `RouteEnum.TRANSACTIONS` with
`?categoryId=<id>` — reusing the same query param and filter mechanism the
transactions table's category pill already uses, so the budget page becomes a
second entry point into one piece of wiring.

## 11. Clicking the user in the transactions table should open a profile modal

**Status:** open — feature request.

The `User` column only appears in household scope and renders flat text:
`ownerColumn` in `TransactionsPage.tsx:38-44` is
`cell: ({ row }) => row.original.ownerName || row.original.ownerEmail`, with no
click target. Seeing whose transaction a row is doesn't get you anywhere —
there's no way to go from a row to that person.

To add it: make the cell a button keyed on the row's owner, opening a
`YmDialog` with that member's profile. The row carries only `ownerName` /
`ownerEmail` (`packages/common/src/types/Transaction.ts`), not an owner id, so
either match against `useGetMyHouseholdQuery()`'s members (already fetched at
`TransactionsPage.tsx:59`) by email, or add `ownerId` to the DTO and the
transaction mapper — the latter is the sounder key.

Two nearby pieces to reuse rather than duplicate:

- `MemberAvatars.tsx:21,36-58` already takes an optional `onMemberClick` and
  renders a clickable avatar for it, but no caller passes the handler —
  `HouseholdPage.tsx:139` renders `<MemberAvatars members={[member]} />` bare.
  That prop is the unfinished half of the same idea.
- `docs/superpowers/plans/2026-08-15-group-member-budget-breakdown.md` and its
  paired spec cover clicking a member to see their budget breakdown (the
  `BudgetBreakdown` component exists). Worth reading first — a member modal
  probably wants to be one shell showing profile and breakdown, not two.

## 12. Run category suggestion generation in the background

**Status:** open — request blocks on the LLM call.

`POST /suggestions`
(`packages/backend/src/modules/categorization/categorization.routes.ts:41-49`)
calls `generate` in `categorization.controller.ts:7-25`, which `await`s
`generateSuggestions` synchronously before responding. `generateSuggestions`
(`categorization.service.ts`) drives `claude.suggester.ts:144-178`, which
chunks transactions 100 at a time and makes one Claude API call per chunk in
series — so a household with a few hundred uncategorized transactions holds
the HTTP request open for several sequential model calls. There's already a
rate limiter on the route (`categorization.routes.ts:38`, "Too many suggestion
runs") that hints this was known to be slow.

To fix: make `POST /suggestions` kick off the job and return immediately
(e.g. `202 Accepted` with a run id, or just fire-and-forget since suggestions
are polled via the existing `GET /suggestions`), and have the frontend poll
`GET /suggestions` until results appear instead of waiting on the POST. Worth
deciding whether this needs a real job queue or can stay in-process given
current volume.
