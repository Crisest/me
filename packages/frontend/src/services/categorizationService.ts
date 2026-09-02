import { apiSlice, tagTypesEnum } from './apiSlice';
import type {
  CategorySuggestion,
  CategorySuggestionPayloads,
} from '@portfolio/common';

export const categorizationApi = apiSlice.injectEndpoints({
  endpoints: builder => ({
    getSuggestions: builder.query<
      CategorySuggestion[],
      CategorySuggestionPayloads.GetMany
    >({
      query: ({ month, year }) => ({
        url: 'transactions/suggestions',
        params: { month, year },
      }),
      providesTags: (_r, _e, arg) => [
        {
          type: tagTypesEnum.CATEGORY_SUGGESTIONS,
          id: `${arg.year}-${arg.month}`,
        },
      ],
    }),

    generateSuggestions: builder.mutation<
      CategorySuggestion[],
      CategorySuggestionPayloads.Generate
    >({
      query: body => ({
        url: 'transactions/suggestions',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [
        {
          type: tagTypesEnum.CATEGORY_SUGGESTIONS,
          id: `${arg.year}-${arg.month}`,
        },
      ],
    }),

    resolveSuggestions: builder.mutation<
      CategorySuggestionPayloads.ResolveResult[],
      CategorySuggestionPayloads.Resolve & { month: number; year: number }
    >({
      query: ({ items }) => ({
        url: 'transactions/suggestions/resolve',
        method: 'POST',
        body: { items },
      }),
      // Accepting writes real tags, so the budget page and insight cards are
      // stale until these are refetched.
      invalidatesTags: (_r, _e, arg) => [
        {
          type: tagTypesEnum.CATEGORY_SUGGESTIONS,
          id: `${arg.year}-${arg.month}`,
        },
        tagTypesEnum.TRANSACTIONS,
        tagTypesEnum.TRANSACTION_INSIGHTS,
        tagTypesEnum.BUDGET_SUMMARY,
      ],
    }),
  }),
});

export const {
  useGetSuggestionsQuery,
  useGenerateSuggestionsMutation,
  useResolveSuggestionsMutation,
} = categorizationApi;
