import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const baseUrl = 'http://localhost:5000/api'; // Replace with your API's base URL

// Define an API slice with endpoints for login and register
export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fetchBaseQuery({ baseUrl }),
  endpoints: builder => ({
    login: builder.mutation<any, { email: string; password: string }>({
      query: credentials => ({
        url: '/auth/login', // Adjust according to your backend route
        method: 'POST',
        body: credentials,
      }),
    }),
    register: builder.mutation<
      any,
      { email: string; password: string; name: string }
    >({
      query: userData => ({
        url: '/auth/register', // Adjust according to your backend route
        method: 'POST',
        body: userData,
      }),
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation } = authApi;
