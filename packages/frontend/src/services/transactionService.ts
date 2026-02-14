import { abstractTagTypesEnum, apiSlice, tagTypesEnum } from './apiSlice';
import type { Transaction, TransactionPayloads } from '@portfolio/common';

export const transactionApi = apiSlice.injectEndpoints({
  endpoints: builder => ({
    getTransactions: builder.query<Transaction[], TransactionPayloads.GetMany>({
      query: ({ month, year }) => ({
        url: 'transactions',
        params: { month, year },
      }),
      providesTags: (r, e, arg) => [
        { type: tagTypesEnum.TRANSACTIONS, id: 'LIST' },
        { type: tagTypesEnum.TRANSACTIONS, id: `${arg.year}-${arg.month}` },
      ],
    }),
    createTransaction: builder.mutation<
      Transaction,
      TransactionPayloads.Create
    >({
      query: transaction => ({
        url: '/transactions',
        method: 'POST',
        body: transaction,
      }),
      invalidatesTags: [tagTypesEnum.TRANSACTIONS],
    }),
    createManyTransactions: builder.mutation<
      Transaction[],
      TransactionPayloads.CreateMany
    >({
      query: payload => ({
        url: '/transactions/bulk',
        method: 'POST',
        body: {
          transactions: payload.transactions,
          cardId: payload.cardId,
          bankId: payload.bankId,
        },
      }),
      invalidatesTags: [
        { type: tagTypesEnum.TRANSACTIONS, id: abstractTagTypesEnum.LIST },
      ],
    }),
  }),
});

export const {
  useGetTransactionsQuery,
  useCreateTransactionMutation,
  useCreateManyTransactionsMutation,
} = transactionApi;
