import { apiSlice, tagTypesEnum } from './apiSlice';
import type { Account, CreateAccountPayload } from '@portfolio/common';

export const accountApi = apiSlice.injectEndpoints({
  endpoints: builder => ({
    getAccounts: builder.query<Account[], void>({
      query: () => ({
        url: '/accounts',
      }),
      transformResponse: (r: { accounts: Account[] }) => r.accounts,
      providesTags: [tagTypesEnum.ACCOUNTS],
    }),
    createAccount: builder.mutation<Account, CreateAccountPayload>({
      query: account => ({
        url: '/accounts',
        method: 'POST',
        body: account,
      }),
      invalidatesTags: [tagTypesEnum.ACCOUNTS],
    }),
  }),
});

export const { useGetAccountsQuery, useCreateAccountMutation } = accountApi;
