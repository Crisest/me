import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
} from '@reduxjs/toolkit/query/react';

const baseUrl = 'http://localhost:3000';

export enum tagTypesEnum {
  USER = 'user',
}

export const apiSlice = createApi({
  reducerPath: 'api',
  tagTypes: [tagTypesEnum.USER],
  baseQuery: fetchBaseQuery({
    baseUrl,
    credentials: 'include',
  }) as BaseQueryFn,
  endpoints: () => ({}),
});
