import { apiSlice, tagTypesEnum } from './apiSlice';
import type { Household, HouseholdPayloads } from '@portfolio/common';

const MEMBERSHIP_INVALIDATES = [
  tagTypesEnum.HOUSEHOLDS,
  tagTypesEnum.BUDGET_SUMMARY,
  tagTypesEnum.BUDGET_CATEGORIES,
  tagTypesEnum.TRANSACTIONS,
];

export const householdApi = apiSlice.injectEndpoints({
  endpoints: builder => ({
    getMyHousehold: builder.query<Household | undefined, void>({
      query: () => '/households',
      transformResponse: (res: { households: Household[] }) => res.households[0],
      providesTags: [tagTypesEnum.HOUSEHOLDS],
    }),

    createHousehold: builder.mutation<Household, HouseholdPayloads.Create>({
      query: payload => ({
        url: '/households',
        method: 'POST',
        body: payload,
      }),
      transformResponse: (res: { household: Household }) => res.household,
      invalidatesTags: MEMBERSHIP_INVALIDATES,
    }),

    joinHousehold: builder.mutation<Household, HouseholdPayloads.Join>({
      query: payload => ({
        url: '/households/join',
        method: 'POST',
        body: payload,
      }),
      transformResponse: (res: { household: Household }) => res.household,
      invalidatesTags: MEMBERSHIP_INVALIDATES,
    }),

    renameHousehold: builder.mutation<
      Household,
      { id: string; payload: HouseholdPayloads.Rename }
    >({
      query: ({ id, payload }) => ({
        url: `/households/${id}`,
        method: 'PATCH',
        body: payload,
      }),
      transformResponse: (res: { household: Household }) => res.household,
      invalidatesTags: [tagTypesEnum.HOUSEHOLDS],
    }),

    regenerateInviteCode: builder.mutation<Household, string>({
      query: id => ({
        url: `/households/${id}/invite-code`,
        method: 'POST',
      }),
      transformResponse: (res: { household: Household }) => res.household,
      invalidatesTags: [tagTypesEnum.HOUSEHOLDS],
    }),

    leaveHousehold: builder.mutation<Household, string>({
      query: id => ({
        url: `/households/${id}/leave`,
        method: 'POST',
      }),
      transformResponse: (res: { household: Household }) => res.household,
      invalidatesTags: MEMBERSHIP_INVALIDATES,
    }),

    removeMember: builder.mutation<
      Household,
      { id: string; payload: HouseholdPayloads.RemoveMember }
    >({
      query: ({ id, payload }) => ({
        url: `/households/${id}/members`,
        method: 'DELETE',
        body: payload,
      }),
      transformResponse: (res: { household: Household }) => res.household,
      invalidatesTags: MEMBERSHIP_INVALIDATES,
    }),
  }),
});

export const {
  useGetMyHouseholdQuery,
  useCreateHouseholdMutation,
  useJoinHouseholdMutation,
  useRenameHouseholdMutation,
  useRegenerateInviteCodeMutation,
  useLeaveHouseholdMutation,
  useRemoveMemberMutation,
} = householdApi;
