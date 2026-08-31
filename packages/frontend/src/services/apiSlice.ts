import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
} from '@reduxjs/toolkit/query/react';

const baseUrl =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:3000' : '/');

export enum tagTypesEnum {
  USER = 'user',
  TRANSACTIONS = 'transactions',
  TRANSACTION_INSIGHTS = 'transactionInsights',
  BANKS = 'banks',
  CARDS = 'cards',
  BUDGET = 'budget',
  BUDGET_CATEGORIES = 'budgetCategories',
  BUDGET_SUMMARY = 'budgetSummary',
  UPLOADS = 'uploads',
  PLAID = 'plaid',
  HOUSEHOLDS = 'households',
}

export enum abstractTagTypesEnum {
  LIST = 'LIST',
}

export const apiSlice = createApi({
  reducerPath: 'api',
  tagTypes: [
    tagTypesEnum.USER,
    tagTypesEnum.TRANSACTIONS,
    tagTypesEnum.TRANSACTION_INSIGHTS,
    tagTypesEnum.BANKS,
    tagTypesEnum.CARDS,
    tagTypesEnum.BUDGET,
    tagTypesEnum.BUDGET_CATEGORIES,
    tagTypesEnum.BUDGET_SUMMARY,
    tagTypesEnum.UPLOADS,
    tagTypesEnum.PLAID,
    tagTypesEnum.HOUSEHOLDS,
  ],
  baseQuery: fetchBaseQuery({
    baseUrl,
    credentials: 'include',
  }) as BaseQueryFn,
  endpoints: () => ({}),
});
