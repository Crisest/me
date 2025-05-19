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
      invalidatesTags: [tagTypesEnum.USER],
    }),
    register: builder.mutation<LoginResponse, RegisterPayload>({
      query: userData => ({
        url: '/auth/register',
        method: 'POST',
        body: userData,
      }),
    }),
    getUser: builder.query<User | null, void>({
      query: () => '/auth/me',
      providesTags: [tagTypesEnum.USER],
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(
            authApi.util.updateQueryData('getUser', undefined, () => null),
          );
          dispatch(authApi.util.resetApiState());
        } catch {}
      },
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useGetUserQuery,
  useLazyGetUserQuery,
  useLogoutMutation,
} = authApi;
