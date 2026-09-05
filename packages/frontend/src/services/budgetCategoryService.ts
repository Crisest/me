import { apiSlice, tagTypesEnum } from './apiSlice';
import type {
  BudgetCategory,
  BudgetCategoryOverride,
  BudgetCategoryPayloads,
  BudgetSummary,
} from '@portfolio/common';

export const budgetCategoryApi = apiSlice.injectEndpoints({
  endpoints: builder => ({
    getBudgetCategories: builder.query<BudgetCategory[], void>({
      query: () => '/budget/categories',
      transformResponse: (res: { categories: BudgetCategory[] }) => res.categories,
      providesTags: [tagTypesEnum.BUDGET_CATEGORIES],
    }),

    createBudgetCategory: builder.mutation<
      BudgetCategory,
      BudgetCategoryPayloads.Create
    >({
      query: payload => ({
        url: '/budget/categories',
        method: 'POST',
        body: payload,
      }),
      transformResponse: (res: { category: BudgetCategory }) => res.category,
      invalidatesTags: [
        tagTypesEnum.BUDGET_CATEGORIES,
        tagTypesEnum.BUDGET_SUMMARY,
      ],
    }),

    updateBudgetCategory: builder.mutation<
      BudgetCategory,
      { id: string; payload: BudgetCategoryPayloads.Update }
    >({
      query: ({ id, payload }) => ({
        url: `/budget/categories/${id}`,
        method: 'PATCH',
        body: payload,
      }),
      transformResponse: (res: { category: BudgetCategory }) => res.category,
      invalidatesTags: [
        tagTypesEnum.BUDGET_CATEGORIES,
        tagTypesEnum.BUDGET_SUMMARY,
      ],
    }),

    deleteBudgetCategory: builder.mutation<void, string>({
      query: id => ({ url: `/budget/categories/${id}`, method: 'DELETE' }),
      invalidatesTags: [
        tagTypesEnum.BUDGET_CATEGORIES,
        tagTypesEnum.BUDGET_SUMMARY,
        tagTypesEnum.TRANSACTIONS,
      ],
    }),

    setCategoryOverride: builder.mutation<
      BudgetCategoryOverride,
      { id: string; payload: BudgetCategoryPayloads.SetOverride }
    >({
      query: ({ id, payload }) => ({
        url: `/budget/categories/${id}/override`,
        method: 'PUT',
        body: payload,
      }),
      transformResponse: (res: { override: BudgetCategoryOverride }) => res.override,
      invalidatesTags: [tagTypesEnum.BUDGET_SUMMARY],
    }),

    clearCategoryOverride: builder.mutation<
      void,
      { id: string; month: number; year: number }
    >({
      query: ({ id, month, year }) => ({
        url: `/budget/categories/${id}/override`,
        method: 'DELETE',
        params: { month, year },
      }),
      invalidatesTags: [tagTypesEnum.BUDGET_SUMMARY],
    }),

    getBudgetSummary: builder.query<
      BudgetSummary,
      BudgetCategoryPayloads.GetSummary
    >({
      query: ({ month, year, scope }) => ({
        url: '/budget/summary',
        params: { month, year, ...(scope !== undefined && { scope }) },
      }),
      transformResponse: (res: { summary: BudgetSummary }) => res.summary,
      providesTags: (_r, _e, arg) => [
        { type: tagTypesEnum.BUDGET_SUMMARY, id: `${arg.year}-${arg.month}` },
        tagTypesEnum.BUDGET_SUMMARY,
      ],
    }),
  }),
});

export const {
  useGetBudgetCategoriesQuery,
  useCreateBudgetCategoryMutation,
  useUpdateBudgetCategoryMutation,
  useDeleteBudgetCategoryMutation,
  useSetCategoryOverrideMutation,
  useClearCategoryOverrideMutation,
  useGetBudgetSummaryQuery,
} = budgetCategoryApi;
