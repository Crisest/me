import { openMongo, closeMongo } from './mongo-source';
import { db } from '../../db/client';
import {
  accounts,
  banks,
  budgetCategories,
  budgetCategoryOverrides,
  budgetOverrides,
  budgets,
  cards,
  groupMembers,
  groups,
  transactions,
  uploads,
  users,
} from '../../db/schema';
import { IdMap } from './id-map';

export type LoadReport = Record<string, { read: number; written: number }>;

/** Every table is loaded in this order so FKs always resolve. */
const ORDER = [
  'users',
  'banks',
  'cards',
  'accounts',
  'budgetcategories',
  'budgets',
  'budgetoverrides',
  'budgetcategoryoverrides',
  'groups',
  'group_members',
  'transactions',
  'uploads',
] as const;

export const runLoad = async (
  options: { dryRun?: boolean } = {}
): Promise<LoadReport> => {
  const mongo = await openMongo();
  const ids = new IdMap();
  const report: LoadReport = {};
  const count = (t: string, read: number, written: number) => {
    report[t] = { read, written };
  };

  const read = async (name: string) =>
    mongo.collection(name).find({}).toArray() as Promise<
      Record<string, unknown>[]
    >;

  try {
    // ONE transaction for the entire load. Any rejection aborts everything;
    // there is no partial-load state to reason about or clean up.
    await db.transaction(async tx => {
      // --- users -------------------------------------------------------------
      const userDocs = await read('users');
      const userRows = userDocs.map(d => ({
        id: ids.assign('users', String(d._id)),
        email: d.email as string,
        passwordHash: d.passwordHash as string,
        name: (d.name as string) ?? null,
        createdAt: (d.createdAt as Date) ?? new Date(),
        // The source has no updatedAt on users; backfill from createdAt.
        updatedAt: (d.createdAt as Date) ?? new Date(),
      }));
      if (userRows.length) await tx.insert(users).values(userRows);
      count('users', userDocs.length, userRows.length);

      // --- banks -------------------------------------------------------------
      const bankDocs = await read('banks');
      const bankRows = bankDocs.map(d => ({
        id: ids.assign('banks', String(d._id)),
        name: d.name as string,
        createdBy: ids.resolve('users', String(d.createdBy)),
        isPlaidLinked: (d.isPlaidLinked as boolean) ?? false,
        plaidAccessToken: (d.plaidAccessToken as string) ?? null,
        plaidItemId: (d.plaidItemId as string) ?? null,
        plaidInstitutionId: (d.plaidInstitutionId as string) ?? null,
        plaidSyncCursor: (d.plaidSyncCursor as string) ?? null,
        plaidStatus:
          (d.plaidStatus as 'connected' | 'login_required' | 'error') ?? null,
        createdAt: (d.createdAt as Date) ?? new Date(),
        updatedAt: (d.updatedAt as Date) ?? (d.createdAt as Date) ?? new Date(),
      }));
      if (bankRows.length) await tx.insert(banks).values(bankRows);
      count('banks', bankDocs.length, bankRows.length);

      // --- cards ---------------------------------------------------------------
      const cardDocs = await read('cards');
      const cardRows = cardDocs.map(d => ({
        id: ids.assign('cards', String(d._id)),
        name: d.name as string,
        bankId: ids.resolve('banks', String(d.bankId)),
        createdBy: ids.resolve('users', String(d.createdBy)),
        createdAt: (d.createdAt as Date) ?? new Date(),
        updatedAt: (d.updatedAt as Date) ?? (d.createdAt as Date) ?? new Date(),
      }));
      if (cardRows.length) await tx.insert(cards).values(cardRows);
      count('cards', cardDocs.length, cardRows.length);

      // --- accounts --------------------------------------------------------------
      const accountDocs = await read('accounts');
      const accountRows = accountDocs.map(d => ({
        id: ids.assign('accounts', String(d._id)),
        bankId: ids.resolve('banks', String(d.bankId)),
        plaidAccountId: d.plaidAccountId as string,
        name: d.name as string,
        officialName: (d.officialName as string) ?? null,
        mask: (d.mask as string) ?? null,
        type: d.type as
          | 'depository'
          | 'credit'
          | 'loan'
          | 'investment'
          | 'other',
        subtype: (d.subtype as string) ?? null,
        createdBy: ids.resolve('users', String(d.createdBy)),
        createdAt: (d.createdAt as Date) ?? new Date(),
        updatedAt: (d.updatedAt as Date) ?? (d.createdAt as Date) ?? new Date(),
      }));
      if (accountRows.length) await tx.insert(accounts).values(accountRows);
      count('accounts', accountDocs.length, accountRows.length);

      // --- budget_categories -----------------------------------------------------
      // Two sources. `budgetcategories` is the collection the feature would
      // write to, which production has never had — categories shipped only
      // after the Postgres branch. The data that became categories lives in
      // production as a `fixedExpenses` array embedded on each budget, so
      // those entries are mapped here too. Each entry carries its own _id,
      // which is what the id map keys on, so the mapping stays stable and
      // traceable back to the source document.
      const budgetDocs = await read('budgets');
      const categoryDocs = await read('budgetcategories');

      const categoryRows = categoryDocs.map(d => ({
        id: ids.assign('budgetcategories', String(d._id)),
        name: d.name as string,
        kind: d.kind as 'fixed' | 'flexible' | 'ignored',
        plannedAmount: d.plannedAmount as number,
        color: (d.color as string) ?? null,
        createdBy: ids.resolve('users', String(d.createdBy)),
        createdAt: (d.createdAt as Date) ?? new Date(),
        updatedAt: (d.updatedAt as Date) ?? (d.createdAt as Date) ?? new Date(),
      }));

      type FixedExpense = { _id: unknown; name: unknown; amount: unknown };
      const fixedExpenseRows = budgetDocs.flatMap(b => {
        const entries = (b.fixedExpenses ?? []) as FixedExpense[];
        const owner = ids.resolve('users', String(b.createdBy));
        return entries.map(e => {
          const amount = e.amount as number;
          // budget_categories_planned_amount_kind_ck requires a positive
          // amount for 'fixed'. Fail by name rather than letting Postgres
          // roll the whole transaction back on an opaque constraint error.
          if (typeof amount !== 'number' || !(amount > 0)) {
            throw new Error(
              `budgets/${String(b._id)} fixedExpense ${String(e.name)}: ` +
                `amount must be a positive number, got ${String(amount)}`
            );
          }
          return {
            id: ids.assign('budgetcategories', String(e._id)),
            name: String(e.name),
            kind: 'fixed' as const,
            plannedAmount: amount,
            // Unused by the UI today, and the source has no equivalent.
            color: null,
            createdBy: owner,
            createdAt: (b.createdAt as Date) ?? new Date(),
            updatedAt: (b.updatedAt as Date) ?? (b.createdAt as Date) ?? new Date(),
          };
        });
      });

      const allCategoryRows = [...categoryRows, ...fixedExpenseRows];
      if (allCategoryRows.length)
        await tx.insert(budgetCategories).values(allCategoryRows);
      count(
        'budgetcategories',
        categoryDocs.length + fixedExpenseRows.length,
        allCategoryRows.length
      );

      // --- budgets -----------------------------------------------------------
      const budgetRows = budgetDocs.map(d => ({
        id: ids.assign('budgets', String(d._id)),
        salary: d.salary as number,
        createdBy: ids.resolve('users', String(d.createdBy)),
        createdAt: (d.createdAt as Date) ?? new Date(),
        updatedAt: (d.updatedAt as Date) ?? (d.createdAt as Date) ?? new Date(),
      }));
      if (budgetRows.length) await tx.insert(budgets).values(budgetRows);
      count('budgets', budgetDocs.length, budgetRows.length);

      // --- budget_overrides ----------------------------------------------------
      const budgetOverrideDocs = await read('budgetoverrides');
      const budgetOverrideRows = budgetOverrideDocs.map(d => ({
        id: ids.assign('budgetoverrides', String(d._id)),
        month: d.month as number,
        year: d.year as number,
        salary: d.salary as number,
        createdBy: ids.resolve('users', String(d.createdBy)),
        createdAt: (d.createdAt as Date) ?? new Date(),
        updatedAt: (d.updatedAt as Date) ?? (d.createdAt as Date) ?? new Date(),
      }));
      if (budgetOverrideRows.length)
        await tx.insert(budgetOverrides).values(budgetOverrideRows);
      count(
        'budgetoverrides',
        budgetOverrideDocs.length,
        budgetOverrideRows.length
      );

      // --- budget_category_overrides ---------------------------------------------
      const bcoDocs = await read('budgetcategoryoverrides');
      const bcoRows = bcoDocs.map(d => ({
        id: ids.assign('budgetcategoryoverrides', String(d._id)),
        categoryId: ids.resolve('budgetcategories', String(d.categoryId)),
        month: d.month as number,
        year: d.year as number,
        plannedAmount: d.plannedAmount as number,
        createdBy: ids.resolve('users', String(d.createdBy)),
        createdAt: (d.createdAt as Date) ?? new Date(),
        updatedAt: (d.updatedAt as Date) ?? (d.createdAt as Date) ?? new Date(),
      }));
      if (bcoRows.length)
        await tx.insert(budgetCategoryOverrides).values(bcoRows);
      count('budgetcategoryoverrides', bcoDocs.length, bcoRows.length);

      // --- groups ----------------------------------------------------------------
      const groupDocs = await read('groups');
      const groupRows = groupDocs.map(d => ({
        id: ids.assign('groups', String(d._id)),
        name: d.name as string,
        inviteCode: d.inviteCode as string,
        createdBy: ids.resolve('users', String(d.createdBy)),
        createdAt: (d.createdAt as Date) ?? new Date(),
        updatedAt: (d.updatedAt as Date) ?? (d.createdAt as Date) ?? new Date(),
      }));
      if (groupRows.length) await tx.insert(groups).values(groupRows);
      count('groups', groupDocs.length, groupRows.length);

      // --- group_members: the union of the two redundant arrays --------------
      // group_members.joined_at has no source field in Mongo: membership was
      // tracked as two unsynchronised arrays (Group.members[] and
      // User.groups[]) with no timestamp anywhere. We backfill from the
      // group's own createdAt — the group cannot have had a member before it
      // existed, and it is the closest available approximation of "when did
      // this membership start" for every member, including ones added later.
      // Both arrays are unioned (not intersected) so a pair recorded on
      // either side is preserved; the audit's membership-drift finding is
      // what surfaces the disagreement for review, not silent data loss here.
      const groupCreatedAt = new Map<string, Date>(
        groupDocs.map(g => [
          String(g._id),
          (g.createdAt as Date) ?? new Date(),
        ])
      );
      const membership = new Set<string>();
      for (const g of groupDocs) {
        for (const m of (g.members as unknown[]) ?? []) {
          membership.add(`${String(g._id)}|${String(m)}`);
        }
      }
      for (const u of userDocs) {
        for (const g of (u.groups as unknown[]) ?? []) {
          membership.add(`${String(g)}|${String(u._id)}`);
        }
      }
      const memberRows = [...membership].map(pair => {
        const [gid, uid] = pair.split('|');
        return {
          groupId: ids.resolve('groups', gid),
          userId: ids.resolve('users', uid),
          joinedAt: groupCreatedAt.get(gid) ?? new Date(),
        };
      });
      if (memberRows.length) await tx.insert(groupMembers).values(memberRows);
      count('group_members', membership.size, memberRows.length);

      // --- transactions ------------------------------------------------------
      const txDocs = await read('transactions');
      const txRows = txDocs.map(d => ({
        id: ids.assign('transactions', String(d._id)),
        amount: d.amount as number,
        description: d.description as string,
        category: (d.category as string) ?? null,
        subDescription: (d.subDescription as string) ?? null,
        date: (d.date as Date) ?? new Date(),
        groupId: ids.resolveOptional('groups', d.groupId as string | null),
        cardId: ids.resolveOptional('cards', d.cardId as string | null),
        accountId: ids.resolveOptional(
          'accounts',
          d.accountId as string | null
        ),
        categoryId: ids.resolveOptional(
          'budgetcategories',
          d.categoryId as string | null
        ),
        createdBy: ids.resolve('users', String(d.createdBy)),
        plaidTransactionId: (d.plaidTransactionId as string) ?? null,
        logoUrl: (d.logoUrl as string) ?? null,
        categoryIconUrl: (d.categoryIconUrl as string) ?? null,
        createdAt: (d.createdAt as Date) ?? new Date(),
        updatedAt: (d.updatedAt as Date) ?? (d.createdAt as Date) ?? new Date(),
      }));
      // Chunk large batches; a single INSERT is capped at 65535 bind parameters.
      for (let i = 0; i < txRows.length; i += 500) {
        await tx.insert(transactions).values(txRows.slice(i, i + 500));
      }
      count('transactions', txDocs.length, txRows.length);

      // --- uploads -----------------------------------------------------------
      const uploadDocs = await read('uploads');
      const uploadRows = uploadDocs.map(d => ({
        id: ids.assign('uploads', String(d._id)),
        fileName: d.fileName as string,
        fileHash: d.fileHash as string,
        cardId: ids.resolve('cards', String(d.cardId)),
        transactionCount: d.transactionCount as number,
        createdBy: ids.resolve('users', String(d.createdBy)),
        createdAt: (d.createdAt as Date) ?? new Date(),
        updatedAt: (d.updatedAt as Date) ?? (d.createdAt as Date) ?? new Date(),
      }));
      if (uploadRows.length) await tx.insert(uploads).values(uploadRows);
      count('uploads', uploadDocs.length, uploadRows.length);

      // Every table must have read === written. A mismatch means a row was
      // dropped, which aborts before commit.
      for (const table of ORDER) {
        const entry = report[table];
        if (entry && entry.read !== entry.written) {
          throw new Error(
            `Count mismatch on ${table}: read ${entry.read}, wrote ${entry.written}. Aborting.`
          );
        }
      }

      if (options.dryRun) {
        throw new Error('DRY_RUN');
      }
    });
  } finally {
    // Always release the Mongo connection, whether the transaction
    // committed, aborted on error, or aborted on purpose for a dry run.
    // Nothing about closing the read-only source affects the transaction
    // outcome above — it has already committed or rolled back by the time
    // this runs.
    await closeMongo();
  }

  return report;
};

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  runLoad({ dryRun })
    .then(report => {
      console.table(report);
      console.log('LOAD COMPLETE. Run etl:verify before switching traffic.');
      process.exit(0);
    })
    .catch(err => {
      if (err.message === 'DRY_RUN') {
        console.log('DRY RUN OK — transaction rolled back, nothing written.');
        process.exit(0);
      }
      console.error('LOAD FAILED — nothing was written.');
      console.error(err);
      process.exit(1);
    });
}
