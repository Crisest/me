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
    prepareHeaders: headers => {
      const token = localStorage.getItem('token');
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }) as BaseQueryFn,
  endpoints: () => ({}),
});
