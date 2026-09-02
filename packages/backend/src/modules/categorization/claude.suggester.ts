import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/env';
import logger from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import type {
  CategorySuggester,
  Suggestion,
  SuggestibleCategory,
  SuggestibleTransaction,
  SuggestionInput,
} from './suggester';

const DEFAULT_CHUNK_SIZE = 100;

/**
 * The model is told to omit anything it is not reasonably confident about.
 * A missing transaction is a normal outcome, not a failure.
 */
const buildSystemPrompt = (categories: SuggestibleCategory[]): string =>
  [
    'You assign personal bank transactions to a household budget category.',
    '',
    'Available categories (id, name, kind):',
    ...categories.map(c => `- ${c.id} | ${c.name} | ${c.kind}`),
    '',
    'Rules:',
    '- Choose only from the category ids listed above.',
    '- A "fixed" category is a recurring monthly bill; a "flexible" category is',
    '  variable spending; an "ignored" category is money that is not spending',
    '  (transfers, credit card payments).',
    '- Omit any transaction you are not reasonably confident about. Returning',
    '  fewer suggestions is better than guessing.',
    '- `reason` must be one short sentence a person can read.',
  ].join('\n');

const buildUserMessage = (
  transactions: SuggestibleTransaction[],
  examples: { description: string; categoryId: string }[]
): string => {
  const parts: string[] = [];

  if (examples.length > 0) {
    parts.push(
      'Categories this household chose before, as precedent:',
      ...examples.map(e => `- "${e.description}" -> ${e.categoryId}`),
      ''
    );
  }

  parts.push(
    'Transactions to categorize:',
    JSON.stringify(
      transactions.map(t => ({
        transactionId: t.id,
        description: t.description,
        plaidPrimary: t.plaidCategory,
        plaidDetailed: t.subDescription,
        amount: t.amount,
        date: t.date.toISOString().slice(0, 10),
      })),
      null,
      2
    )
  );

  return parts.join('\n');
};

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          transactionId: { type: 'string' },
          categoryId: { type: 'string' },
          confidence: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['transactionId', 'categoryId', 'confidence', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['suggestions'],
  additionalProperties: false,
} as const;

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/**
 * A model response is untrusted input. Anything that is not a well-formed
 * entry naming an offered transaction and an offered category is dropped.
 */
const parseResponse = (
  raw: unknown,
  offeredTransactionIds: Set<string>,
  offeredCategoryIds: Set<string>
): Suggestion[] => {
  const body = raw as { suggestions?: unknown };
  if (!Array.isArray(body?.suggestions)) return [];

  return body.suggestions.flatMap((entry: unknown) => {
    const s = entry as Partial<Suggestion>;
    if (typeof s?.transactionId !== 'string') return [];
    if (typeof s?.categoryId !== 'string') return [];
    if (typeof s?.confidence !== 'number' || Number.isNaN(s.confidence)) return [];
    if (typeof s?.reason !== 'string') return [];
    if (!offeredTransactionIds.has(s.transactionId)) return [];
    if (!offeredCategoryIds.has(s.categoryId)) return [];
    return [
      {
        transactionId: s.transactionId,
        categoryId: s.categoryId,
        confidence: Math.min(1, Math.max(0, s.confidence)),
        reason: s.reason,
      },
    ];
  });
};

export const createClaudeSuggester = (
  client: Anthropic,
  model: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): CategorySuggester => ({
  name: 'claude',

  async suggest(input: SuggestionInput): Promise<Suggestion[]> {
    if (input.transactions.length === 0 || input.categories.length === 0) {
      return [];
    }

    const system = buildSystemPrompt(input.categories);
    const offeredCategoryIds = new Set(input.categories.map(c => c.id));
    const results: Suggestion[] = [];

    for (const batch of chunk(input.transactions, chunkSize)) {
      const offeredTransactionIds = new Set(batch.map(t => t.id));
      try {
        const response = await client.messages.create({
          model,
          max_tokens: 16000,
          system,
          thinking: { type: 'adaptive' },
          // Classification does not repay deep reasoning.
          output_config: {
            effort: 'low',
            format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
          },
          messages: [
            { role: 'user', content: buildUserMessage(batch, input.examples) },
          ],
        } as never);

        const text = (response as { content: { type: string; text?: string }[] }).content
          .filter(b => b.type === 'text')
          .map(b => b.text ?? '')
          .join('');

        results.push(
          ...parseResponse(JSON.parse(text), offeredTransactionIds, offeredCategoryIds)
        );
      } catch (err) {
        // A failed chunk leaves its transactions unsuggested rather than
        // failing the whole run.
        logger.warn(
          { err, transactionCount: batch.length },
          'categorization chunk failed'
        );
      }
    }

    return results;
  },
});

/** Built from config. `undefined` when no API key is set: history-only. */
export const resolveSuggester = (): CategorySuggester | undefined => {
  const { apiKey, model } = config.categorization;
  if (!apiKey) return undefined;
  return createClaudeSuggester(new Anthropic({ apiKey }), model);
};

/**
 * Most specific first. Rate limiting is retryable and says so; a bad key is a
 * configuration fault the user cannot act on, so it is logged loudly and
 * surfaced generically.
 */
export const toAppError = (err: unknown): AppError => {
  if (err instanceof Anthropic.RateLimitError) {
    return new AppError('Suggestions are busy right now. Try again shortly.', 503);
  }
  if (err instanceof Anthropic.AuthenticationError) {
    logger.error({ err }, 'ANTHROPIC_API_KEY is invalid');
    return new AppError('Could not generate suggestions', 500);
  }
  if (err instanceof Anthropic.APIError) {
    return new AppError('The suggestion service is unavailable', 502);
  }
  return new AppError('Could not generate suggestions', 500);
};
