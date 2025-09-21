import { apiSlice, tagTypesEnum } from './apiSlice';
import type { Bank, CreateBankPayload } from '@portfolio/common';

export const bankApi = apiSlice.injectEndpoints({
  endpoints: builder => ({
    getBanks: builder.query<Bank[], void>({
      query: () => ({
        url: 'banks',
      }),
      providesTags: [tagTypesEnum.BANKS],
    }),
    createBank: builder.mutation<Bank, CreateBankPayload>({
      query: bank => ({
        url: '/banks',
        method: 'POST',
        body: bank,
      }),
      invalidatesTags: [tagTypesEnum.BANKS],
    }),
  }),
});

export const { useGetBanksQuery, useCreateBankMutation } = bankApi;
