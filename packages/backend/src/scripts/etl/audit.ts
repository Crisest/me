import { openMongo, closeMongo, COLLECTIONS, KNOWN_FIELDS } from './mongo-source';

export type FindingKind =
  | 'orphan-required'
  | 'orphan-optional'
  | 'unknown-field'
  | 'missing-required'
  | 'check-violation'
  | 'duplicate'
  | 'precision-loss'
  | 'membership-drift'
  | 'type-anomaly';

export type Finding = {
  collection: string;
  documentId: string;
  kind: FindingKind;
  detail: string;
  /** 'halt' blocks the load outright. 'resolve' needs an explicit decision. */
  severity: 'halt' | 'resolve';
};

type RefSpec = Record<string, { ids: Set<string>; required: boolean }>;

export const checkOrphans = (
  collection: string,
  docs: Record<string, unknown>[],
  refs: RefSpec
): Finding[] => {
  const out: Finding[] = [];
  for (const doc of docs) {
    for (const [field, spec] of Object.entries(refs)) {
      const value = doc[field];
      if (value == null) continue;
      if (!spec.ids.has(String(value))) {
        out.push({
          collection,
          documentId: String(doc._id),
          kind: spec.required ? 'orphan-required' : 'orphan-optional',
          detail: `${field}=${String(value)} does not resolve`,
          severity: spec.required ? 'halt' : 'resolve',
        });
      }
    }
  }
  return out;
};

export const checkUnknownFields = (
  collection: string,
  docs: Record<string, unknown>[]
): Finding[] => {
  const known = new Set(KNOWN_FIELDS[collection] ?? []);
  const out: Finding[] = [];
  for (const doc of docs) {
    const extra = Object.keys(doc).filter(k => !known.has(k));
    if (extra.length > 0) {
      out.push({
        collection,
        documentId: String(doc._id),
        kind: 'unknown-field',
        // Data we do not map is data we lose, so this always halts.
        detail: `unmapped fields: ${extra.join(', ')}`,
        severity: 'halt',
      });
    }
  }
  return out;
};

const MAX_NUMERIC_12_2 = 9_999_999_999.99;

export const checkPrecision = (
  collection: string,
  field: string,
  docs: Record<string, unknown>[]
): Finding[] => {
  const out: Finding[] = [];
  for (const doc of docs) {
    const value = doc[field];
    if (typeof value !== 'number') continue;

    if (Math.abs(value) > MAX_NUMERIC_12_2) {
      out.push({
        collection,
        documentId: String(doc._id),
        kind: 'precision-loss',
        detail: `${field}=${value} exceeds numeric(12,2)`,
        severity: 'halt',
      });
      continue;
    }
    // More than two decimal places would be silently rounded on insert.
    if (Math.round(value * 100) / 100 !== value) {
      out.push({
        collection,
        documentId: String(doc._id),
        kind: 'precision-loss',
        detail: `${field}=${value} has more than 2 decimal places`,
        severity: 'halt',
      });
    }
  }
  return out;
};

export const checkMembershipDrift = (
  groupDocs: { _id: unknown; members?: unknown[] }[],
  userDocs: { _id: unknown; groups?: unknown[] }[]
): Finding[] => {
  const out: Finding[] = [];
  const userGroups = new Map(
    userDocs.map(u => [String(u._id), new Set((u.groups ?? []).map(String))])
  );

  for (const g of groupDocs) {
    const gid = String(g._id);
    const listed = new Set((g.members ?? []).map(String));

    for (const uid of listed) {
      if (!userGroups.get(uid)?.has(gid)) {
        out.push({
          collection: 'groups',
          documentId: gid,
          kind: 'membership-drift',
          detail: `group lists ${uid} but user.groups does not list the group`,
          severity: 'resolve',
        });
      }
    }
    for (const [uid, gids] of userGroups) {
      if (gids.has(gid) && !listed.has(uid)) {
        out.push({
          collection: 'groups',
          documentId: gid,
          kind: 'membership-drift',
          detail: `user ${uid} claims membership the group does not list`,
          severity: 'resolve',
        });
      }
    }
  }
  return out;
};

export const runAudit = async (): Promise<Finding[]> => {
  const mongo = await openMongo();
  const findings: Finding[] = [];

  const docsByCollection: Record<string, Record<string, unknown>[]> = {};
  for (const name of COLLECTIONS) {
    docsByCollection[name] = await mongo.collection(name).find({}).toArray();
  }

  const idsOf = (name: string) =>
    new Set(docsByCollection[name].map(d => String(d._id)));

  const userIds = idsOf('users');
  const bankIds = idsOf('banks');
  const cardIds = idsOf('cards');
  const accountIds = idsOf('accounts');
  const categoryIds = idsOf('budgetcategories');
  const groupIds = idsOf('groups');

  // Referential integrity, per the FK definitions in db/schema.
  findings.push(
    ...checkOrphans('banks', docsByCollection.banks, {
      createdBy: { ids: userIds, required: true },
    }),
    ...checkOrphans('cards', docsByCollection.cards, {
      bankId: { ids: bankIds, required: true },
      createdBy: { ids: userIds, required: true },
    }),
    ...checkOrphans('accounts', docsByCollection.accounts, {
      bankId: { ids: bankIds, required: true },
      createdBy: { ids: userIds, required: true },
    }),
    ...checkOrphans('budgetcategories', docsByCollection.budgetcategories, {
      createdBy: { ids: userIds, required: true },
    }),
    ...checkOrphans('budgets', docsByCollection.budgets, {
      createdBy: { ids: userIds, required: true },
    }),
    ...checkOrphans('budgetoverrides', docsByCollection.budgetoverrides, {
      createdBy: { ids: userIds, required: true },
    }),
    ...checkOrphans(
      'budgetcategoryoverrides',
      docsByCollection.budgetcategoryoverrides,
      {
        categoryId: { ids: categoryIds, required: true },
        createdBy: { ids: userIds, required: true },
      }
    ),
    ...checkOrphans('groups', docsByCollection.groups, {
      createdBy: { ids: userIds, required: true },
    }),
    ...checkOrphans('uploads', docsByCollection.uploads, {
      cardId: { ids: cardIds, required: true },
      createdBy: { ids: userIds, required: true },
    }),
    ...checkOrphans('transactions', docsByCollection.transactions, {
      createdBy: { ids: userIds, required: true },
      cardId: { ids: cardIds, required: false },
      accountId: { ids: accountIds, required: false },
      groupId: { ids: groupIds, required: false },
      categoryId: { ids: categoryIds, required: false },
    })
  );

  for (const name of COLLECTIONS) {
    findings.push(...checkUnknownFields(name, docsByCollection[name]));
  }

  findings.push(
    ...checkPrecision('transactions', 'amount', docsByCollection.transactions),
    ...checkPrecision('budgets', 'salary', docsByCollection.budgets),
    ...checkPrecision('budgetoverrides', 'salary', docsByCollection.budgetoverrides),
    ...checkPrecision(
      'budgetcategories',
      'plannedAmount',
      docsByCollection.budgetcategories
    ),
    ...checkPrecision(
      'budgetcategoryoverrides',
      'plannedAmount',
      docsByCollection.budgetcategoryoverrides
    ),
    ...checkMembershipDrift(
      docsByCollection.groups as never,
      docsByCollection.users as never
    )
  );

  // CHECK constraint violations that predate the validators.
  for (const doc of docsByCollection.budgetcategories) {
    const kind = doc.kind as string;
    const amount = doc.plannedAmount as number;
    const ok =
      (kind === 'ignored' && amount === 0) || (kind !== 'ignored' && amount > 0);
    if (!ok) {
      findings.push({
        collection: 'budgetcategories',
        documentId: String(doc._id),
        kind: 'check-violation',
        detail: `kind=${kind} with plannedAmount=${amount}`,
        severity: 'resolve',
      });
    }
  }
  for (const name of ['budgetoverrides', 'budgetcategoryoverrides'] as const) {
    for (const doc of docsByCollection[name]) {
      const month = doc.month as number;
      if (!(month >= 1 && month <= 12)) {
        findings.push({
          collection: name,
          documentId: String(doc._id),
          kind: 'check-violation',
          detail: `month=${month} outside 1-12`,
          severity: 'halt',
        });
      }
    }
  }

  // Uniqueness the target enforces but Mongo may not have.
  const dupCheck = (
    name: string,
    keyFn: (d: Record<string, unknown>) => string | null
  ) => {
    const seen = new Map<string, string>();
    for (const doc of docsByCollection[name]) {
      const key = keyFn(doc);
      if (key === null) continue;
      const prev = seen.get(key);
      if (prev) {
        findings.push({
          collection: name,
          documentId: String(doc._id),
          kind: 'duplicate',
          detail: `duplicates ${prev} on ${key}`,
          severity: 'halt',
        });
      } else {
        seen.set(key, String(doc._id));
      }
    }
  };

  dupCheck('users', d => String(d.email ?? ''));
  dupCheck('groups', d => String(d.inviteCode ?? ''));
  dupCheck('accounts', d => String(d.plaidAccountId ?? ''));
  dupCheck('transactions', d =>
    d.plaidTransactionId ? String(d.plaidTransactionId) : null
  );
  dupCheck('budgets', d => String(d.createdBy ?? ''));
  dupCheck('budgetoverrides', d => `${d.createdBy}|${d.month}|${d.year}`);
  dupCheck('budgetcategoryoverrides', d =>
    `${d.createdBy}|${d.categoryId}|${d.month}|${d.year}`
  );

  await closeMongo();
  return findings;
};

if (require.main === module) {
  runAudit()
    .then(findings => {
      if (findings.length === 0) {
        console.log('AUDIT PASSED: no findings. Safe to proceed to etl:load.');
        process.exit(0);
      }

      const bySeverity = { halt: 0, resolve: 0 };
      for (const f of findings) {
        bySeverity[f.severity] += 1;
        console.log(
          `[${f.severity.toUpperCase()}] ${f.collection}/${f.documentId} ` +
            `${f.kind}: ${f.detail}`
        );
      }
      console.log(
        `\nAUDIT FAILED: ${findings.length} finding(s) — ` +
          `${bySeverity.halt} halt, ${bySeverity.resolve} to resolve.`
      );
      console.log('Every finding needs an explicit decision before etl:load.');
      process.exit(1);
    })
    .catch(err => {
      console.error(err);
      process.exit(2);
    });
}
