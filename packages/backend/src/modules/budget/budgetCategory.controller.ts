import { Request, Response, NextFunction } from 'express';
import { BudgetCategoryPayloads } from '@portfolio/common';
import * as categoryService from './budgetCategory.service';
import * as budgetService from './budget.service';
import { getBudgetSummary } from './budgetSummary.service';

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
    const summary = await getBudgetSummary(
      req.budgetScope!,
      Number(req.query.month),
      Number(req.query.year)
    );
    res.json({ summary });
  } catch (err) {
    next(err);
  }
};
