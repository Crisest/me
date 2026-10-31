import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';

const baseUrl =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:3000' : '/');

const rawBaseQuery = fetchBaseQuery({ baseUrl, credentials: 'include' });

// A 401 from anything but the auth endpoints means the session died
// mid-use. Dropping the cache makes PrivateRoutes re-check /auth/me and
// redirect to login.
const AUTH_ENDPOINTS = ['getUser', 'login'];

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401 && !AUTH_ENDPOINTS.includes(api.endpoint)) {
    api.dispatch(apiSlice.util.resetApiState());
  }
  return result;
};

export enum tagTypesEnum {
  USER = 'user',
  TRANSACTIONS = 'transactions',
  TRANSACTION_INSIGHTS = 'transactionInsights',
  BANKS = 'banks',
  ACCOUNTS = 'accounts',
  BUDGET = 'budget',
  BUDGET_CATEGORIES = 'budgetCategories',
  BUDGET_SUMMARY = 'budgetSummary',
  BUDGET_SNAPSHOT = 'budgetSnapshot',
  UPLOADS = 'uploads',
  PLAID = 'plaid',
  HOUSEHOLDS = 'households',
  CATEGORY_SUGGESTIONS = 'categorySuggestions',
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
    tagTypesEnum.ACCOUNTS,
    tagTypesEnum.BUDGET,
    tagTypesEnum.BUDGET_CATEGORIES,
    tagTypesEnum.BUDGET_SUMMARY,
    tagTypesEnum.BUDGET_SNAPSHOT,
    tagTypesEnum.UPLOADS,
    tagTypesEnum.PLAID,
    tagTypesEnum.HOUSEHOLDS,
    tagTypesEnum.CATEGORY_SUGGESTIONS,
  ],
  baseQuery: baseQueryWithReauth,
  endpoints: () => ({}),
});
