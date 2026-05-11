import { apiSlice, tagTypesEnum } from './apiSlice';
import type { Budget, BudgetPayloads, BudgetOverride, BudgetOverridePayloads } from '@portfolio/common';

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
    getBudgetOverride: builder.query<BudgetOverride | null, BudgetOverridePayloads.GetOne>({
      query: ({ month, year }) => `/budget/override?month=${month}&year=${year}`,
      transformResponse: (res: { override: BudgetOverride | null }) => res.override,
      providesTags: [tagTypesEnum.BUDGET],
    }),
    upsertBudgetOverride: builder.mutation<BudgetOverride, BudgetOverridePayloads.Upsert>({
      query: payload => ({ url: '/budget/override', method: 'PUT', body: payload }),
      transformResponse: (res: { override: BudgetOverride }) => res.override,
      invalidatesTags: [tagTypesEnum.BUDGET],
    }),
  }),
});

export const {
  useGetBudgetQuery,
  useUpsertBudgetMutation,
  useGetBudgetOverrideQuery,
  useUpsertBudgetOverrideMutation,
} = budgetApi;
