import { apiSlice, tagTypesEnum } from './apiSlice';
import type { BudgetMonthSnapshot, BudgetPayloads } from '@portfolio/common';

export const monthCloseApi = apiSlice.injectEndpoints({
  endpoints: builder => ({
    closeMonth: builder.mutation<BudgetMonthSnapshot, BudgetPayloads.Close>({
      query: payload => ({
        url: '/budget/close',
        method: 'POST',
        body: payload,
      }),
      transformResponse: (res: { snapshot: BudgetMonthSnapshot }) => res.snapshot,
      // The summary now resolves from the snapshot rather than live state, and
      // the transactions list is what the snapshot was built from — both are
      // stale the moment a month closes.
      invalidatesTags: [
        tagTypesEnum.BUDGET_SUMMARY,
        tagTypesEnum.BUDGET_SNAPSHOT,
        tagTypesEnum.TRANSACTIONS,
      ],
    }),

    getMonthSnapshot: builder.query<
      BudgetMonthSnapshot | null,
      { month: number; year: number }
    >({
      query: ({ month, year }) => ({
        url: '/budget/snapshot',
        params: { month, year },
      }),
      transformResponse: (res: { snapshot: BudgetMonthSnapshot | null }) =>
        res.snapshot,
      providesTags: (_r, _e, arg) => [
        { type: tagTypesEnum.BUDGET_SNAPSHOT, id: `${arg.year}-${arg.month}` },
        tagTypesEnum.BUDGET_SNAPSHOT,
      ],
    }),
  }),
});

export const {
  useCloseMonthMutation,
  useGetMonthSnapshotQuery,
  useLazyGetMonthSnapshotQuery,
} = monthCloseApi;
