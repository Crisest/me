import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { householdMembers, households } from '../db/schema';
import { createHousehold, getActiveMembership } from '../modules/households/household.service';

export type ScopeMember = { userId: string; from: Date; to: Date | null };

export type BudgetScope = {
  householdId: string;
  members: ScopeMember[];
};

/**
 * Resolves whose budget this request reads. Requires authMiddleware to have run.
 *
 * `members` carries tenure windows, not a flat id list: a member's transactions
 * only count toward the household for the months they were actually in it.
 */
export const resolveBudgetScope = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;

    let householdId: string | undefined;
    const membership = await getActiveMembership(userId);

    if (membership) {
      const [household] = await db
        .select({ id: households.id, archived: households.archived })
        .from(households)
        .where(eq(households.id, membership.householdId))
        .limit(1);
      if (household && !household.archived) householdId = household.id;
    }

    if (!householdId) {
      // The invariant is "at most one active membership", not "at least one".
      // A user with none gets a household rather than an error.
      const created = await createHousehold('My Household', userId);
      householdId = created.id;
    }

    const rows = await db
      .select({
        userId: householdMembers.userId,
        from: householdMembers.createdAt,
        to: householdMembers.deletedAt,
      })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, householdId));

    req.budgetScope = {
      householdId,
      members: rows.map(r => ({ userId: r.userId, from: r.from, to: r.to })),
    };
    next();
  } catch (err) {
    next(err);
  }
};
