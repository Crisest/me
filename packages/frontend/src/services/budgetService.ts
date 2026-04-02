import { apiSlice, tagTypesEnum } from './apiSlice';
import type { Budget, BudgetPayloads } from '@portfolio/common';

export const budgetApi = apiSlice.injectEndpoints({
  endpoints: builder => ({
    getBudget: builder.query<Budget | null, void>({
      query: () => '/budget',
      transformResponse: (res: { budget: Budget | null }) => res.budget,
      providesTags: [tagTypesEnum.BUDGET],
    }),
    upsertBudget: builder.mutation<Budget, BudgetPayloads.Upsert>({
      query: payload => ({ url: '/budget', method: 'PUT', body: payload }),
      transformResponse: (res: { budget: Budget }) => res.budget,
      invalidatesTags: [tagTypesEnum.BUDGET],
    }),
  }),
});

export const { useGetBudgetQuery, useUpsertBudgetMutation } = budgetApi;
