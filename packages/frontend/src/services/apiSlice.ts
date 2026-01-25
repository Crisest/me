import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
} from '@reduxjs/toolkit/query/react';

const baseUrl = 'http://localhost:3000';

export enum tagTypesEnum {
  USER = 'user',
  TRANSACTIONS = 'transactions',
  BANKS = 'banks',
  CARDS = 'cards',
}

export enum abstractTagTypesEnum {
  LIST = 'LIST',
}

export const apiSlice = createApi({
  reducerPath: 'api',
  tagTypes: [
    tagTypesEnum.USER,
    tagTypesEnum.TRANSACTIONS,
    tagTypesEnum.BANKS,
    tagTypesEnum.CARDS,
  ],
  baseQuery: fetchBaseQuery({
    baseUrl,
    credentials: 'include',
  }) as BaseQueryFn,
  endpoints: () => ({}),
});
