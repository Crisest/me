import { apiSlice, tagTypesEnum } from './apiSlice';
import type {
  Transaction,
  CreateTransactionsPayload,
  CreateTransactionPayload,
} from '@portfolio/common';

export const transactionApi = apiSlice.injectEndpoints({
  endpoints: builder => ({
    getTransactions: builder.query<Transaction[], number>({
      query: month => ({
        url: 'transactions',
        params: month ? { month } : undefined,
      }),
      providesTags: [tagTypesEnum.TRANSACTIONS],
    }),
    createTransaction: builder.mutation<Transaction, CreateTransactionPayload>({
      query: transaction => ({
        url: '/transactions',
        method: 'POST',
        body: transaction,
      }),
      invalidatesTags: [tagTypesEnum.TRANSACTIONS],
    }),
    createManyTransactions: builder.mutation<
      Transaction[],
      CreateTransactionsPayload
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
      invalidatesTags: [tagTypesEnum.TRANSACTIONS],
    }),
  }),
});

export const {
  useGetTransactionsQuery,
  useCreateTransactionMutation,
  useCreateManyTransactionsMutation,
} = transactionApi;
