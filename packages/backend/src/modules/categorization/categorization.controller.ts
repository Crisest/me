import { NextFunction, Request, Response } from 'express';
import type { CategorySuggestionPayloads } from '@portfolio/common';
import { toAppError } from './claude.suggester';
import { generateSuggestions, getPendingSuggestions } from './categorization.service';
import { resolveSuggestions } from './categorization.resolve.service';

export const generate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.body as CategorySuggestionPayloads.Generate;

    const suggestions = await generateSuggestions(req.budgetScope!, req.user!.id, {
      month,
      year,
    });

    req.log.info(
      { month, year, created: suggestions.length },
      'category suggestions generated'
    );
    res.status(201).json(suggestions);
  } catch (err) {
    req.log.error({ err }, 'Failed to generate category suggestions');
    next(toAppError(err));
  }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.query as unknown as CategorySuggestionPayloads.GetMany;
    res.json(await getPendingSuggestions(req.budgetScope!, { month, year }));
  } catch (err) {
    req.log.error({ err }, 'Failed to fetch category suggestions');
    next(err);
  }
};

export const resolve = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items } = req.body as CategorySuggestionPayloads.Resolve;

    const results = await resolveSuggestions(req.budgetScope!, req.user!.id, items);

    req.log.info(
      { requested: items.length, failed: results.filter(r => !r.ok).length },
      'category suggestions resolved'
    );
    res.json(results);
  } catch (err) {
    req.log.error({ err }, 'Failed to resolve category suggestions');
    next(err);
  }
};
