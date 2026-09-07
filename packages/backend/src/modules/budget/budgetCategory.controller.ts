import { Request, Response, NextFunction } from 'express';
import { BudgetCategoryPayloads, BudgetPayloads } from '@portfolio/common';
import * as categoryService from './budgetCategory.service';
import * as budgetService from './budget.service';
import { getBudgetSummary } from './budgetSummary.service';
import { closeMonth, getMonthCloseState } from './monthClose.service';
import { getLiveSnapshot } from './monthSnapshot.service';
import { toBudgetMonthSnapshot } from './monthSnapshot.mapper';

export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categories = await categoryService.listCategories(req.budgetScope!);
    res.json({ categories });
  } catch (err) {
    next(err);
  }
};

export const postCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = req.body as BudgetCategoryPayloads.Create;
    const category = await categoryService.createCategory(
      req.budgetScope!,
      req.user!.id,
      payload
    );
    req.log.info({ categoryId: category.id }, 'budget category created');
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
};

export const patchCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = req.body as BudgetCategoryPayloads.Update;
    const category = await categoryService.updateCategory(
      req.budgetScope!,
      req.user!.id,
      req.params.id,
      payload
    );
    res.json({ category });
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await categoryService.deleteCategory(req.budgetScope!, req.params.id);
    req.log.info({ categoryId: req.params.id }, 'budget category deleted');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const putCategoryOverride = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = req.body as BudgetCategoryPayloads.SetOverride;
    const override = await budgetService.upsertCategoryOverride(
      req.budgetScope!,
      req.user!.id,
      req.params.id,
      payload
    );
    res.json({ override });
  } catch (err) {
    next(err);
  }
};

export const deleteCategoryOverride = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await budgetService.deleteCategoryOverride(
      req.budgetScope!,
      req.params.id,
      Number(req.query.month),
      Number(req.query.year)
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const getSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    // Default household: the budget overview has always read the whole
    // household, and an omitted `scope` must not quietly change it.
    const memberId = req.query.scope === 'mine' ? req.user!.id : undefined;
    const summary = await getBudgetSummary(
      req.budgetScope!,
      month,
      year,
      memberId
    );

    // Readiness rides on the summary response rather than surfacing as an
    // error at click time: both members need to see the blockers before
    // anyone tries to close.
    //
    // Only for the household view. Closing is a household act, and computing
    // it under `scope=mine` would mean a SECOND full getBudgetSummary — the
    // heaviest read in the app — on every transactions-page load, for a field
    // that page does not render.
    if (memberId !== undefined) {
      res.json({ summary });
      return;
    }

    const close = await getMonthCloseState(
      req.budgetScope!,
      summary,
      month,
      year
    );
    res.json({ summary, close });
  } catch (err) {
    next(err);
  }
};

export const postClose = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { month, year } = req.body as BudgetPayloads.Close;
    const row = await closeMonth(req.budgetScope!, req.user!.id, month, year);
    req.log.info(
      { snapshotId: row.id, month, year, transactions: row.transactions.length },
      'month closed'
    );
    res.status(201).json({ snapshot: toBudgetMonthSnapshot(row) });
  } catch (err) {
    next(err);
  }
};

export const getSnapshot = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const row = await getLiveSnapshot(
      req.budgetScope!.householdId,
      Number(req.query.month),
      Number(req.query.year)
    );
    res.json({ snapshot: row ? toBudgetMonthSnapshot(row) : null });
  } catch (err) {
    next(err);
  }
};
