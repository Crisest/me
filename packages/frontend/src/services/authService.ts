import { apiSlice, tagTypesEnum } from './apiSlice';
import type {
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  User,
} from '@portfolio/common';

export const authApi = apiSlice.injectEndpoints({
  endpoints: builder => ({
    login: builder.mutation<LoginResponse, LoginPayload>({
      query: credentials => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),
    register: builder.mutation<LoginResponse, RegisterPayload>({
      query: userData => ({
        url: '/auth/register',
        method: 'POST',
        body: userData,
      }),
    }),
    getUser: builder.query<User, void>({
      query: () => '/auth/me',
      providesTags: [tagTypesEnum.USER],
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: [tagTypesEnum.USER],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useGetUserQuery,
  useLogoutMutation,
} = authApi;
