import { apiSlice, tagTypesEnum } from './apiSlice';
import type { Bank, PlaidPayloads } from '@portfolio/common';

export const plaidApi = apiSlice.injectEndpoints({
  endpoints: builder => ({
    createLinkToken: builder.mutation<PlaidPayloads.CreateLinkTokenResponse, void>({
      query: () => ({ url: '/plaid/link-token', method: 'POST' }),
    }),
    createUpdateLinkToken: builder.mutation<
      PlaidPayloads.CreateLinkTokenResponse,
      { bankId: string }
    >({
      query: ({ bankId }) => ({
        url: `/plaid/link-token/update/${bankId}`,
        method: 'POST',
      }),
    }),
    exchangeToken: builder.mutation<
      PlaidPayloads.ExchangeTokenResponse,
      PlaidPayloads.ExchangeTokenRequest
    >({
      query: body => ({
        url: '/plaid/exchange-token',
        method: 'POST',
        body,
      }),
      invalidatesTags: [tagTypesEnum.BANKS, tagTypesEnum.PLAID],
    }),
    syncBank: builder.mutation<PlaidPayloads.SyncResponse, { bankId: string }>({
      query: ({ bankId }) => ({
        url: `/plaid/sync/${bankId}`,
        method: 'POST',
      }),
      invalidatesTags: [tagTypesEnum.TRANSACTIONS, tagTypesEnum.BANKS, tagTypesEnum.PLAID],
    }),
    syncAllBanks: builder.mutation<PlaidPayloads.SyncResponse, void>({
      query: () => ({ url: '/plaid/sync', method: 'POST' }),
      invalidatesTags: [tagTypesEnum.TRANSACTIONS, tagTypesEnum.BANKS, tagTypesEnum.PLAID],
    }),
    unlinkBank: builder.mutation<void, { bankId: string }>({
      query: ({ bankId }) => ({
        url: `/plaid/bank/${bankId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [tagTypesEnum.BANKS, tagTypesEnum.PLAID],
    }),
  }),
});

export const {
  useCreateLinkTokenMutation,
  useCreateUpdateLinkTokenMutation,
  useExchangeTokenMutation,
  useSyncBankMutation,
  useSyncAllBanksMutation,
  useUnlinkBankMutation,
} = plaidApi;

export type LinkedBank = Bank & { isPlaidLinked: true };
