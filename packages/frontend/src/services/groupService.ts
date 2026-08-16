import { apiSlice, tagTypesEnum } from './apiSlice';
import type {
  GroupWithMembers,
  CreateGroupPayload,
  Transaction,
  GroupBudgetInsights,
  Budget,
} from '@portfolio/common';

export const groupApi = apiSlice.injectEndpoints({
  endpoints: builder => ({
    getGroups: builder.query<
      GroupWithMembers[],
      { month: number; year: number } | void
    >({
      query: arg => ({
        url: 'groups',
        params: arg ? { month: arg.month, year: arg.year } : undefined,
      }),
      providesTags: [{ type: tagTypesEnum.GROUPS, id: 'LIST' }],
    }),
    createGroup: builder.mutation<GroupWithMembers, CreateGroupPayload>({
      query: body => ({
        url: 'groups',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: tagTypesEnum.GROUPS, id: 'LIST' }],
    }),
    addGroupMember: builder.mutation<GroupWithMembers, { groupId: string; userId: string }>({
      query: ({ groupId, userId }) => ({
        url: `groups/${groupId}/members`,
        method: 'POST',
        body: { userId },
      }),
      invalidatesTags: [{ type: tagTypesEnum.GROUPS, id: 'LIST' }],
    }),
    removeGroupMember: builder.mutation<GroupWithMembers, { groupId: string; userId: string }>({
      query: ({ groupId, userId }) => ({
        url: `groups/${groupId}/members`,
        method: 'DELETE',
        body: { userId },
      }),
      invalidatesTags: [{ type: tagTypesEnum.GROUPS, id: 'LIST' }],
    }),
    getGroupTransactions: builder.query<
      Transaction[],
      { groupId: string; month: number; year: number }
    >({
      query: ({ groupId, month, year }) => ({
        url: `groups/${groupId}/transactions`,
        params: { month, year },
      }),
      providesTags: (_r, _e, arg) => [
        { type: tagTypesEnum.GROUPS, id: `txn-${arg.groupId}-${arg.year}-${arg.month}` },
      ],
    }),
    getGroupInsights: builder.query<
      GroupBudgetInsights,
      { groupId: string; month: number; year: number }
    >({
      query: ({ groupId, month, year }) => ({
        url: `groups/${groupId}/insights/${month}`,
        params: { year },
      }),
      providesTags: (_r, _e, arg) => [
        { type: tagTypesEnum.GROUPS, id: `insights-${arg.groupId}-${arg.year}-${arg.month}` },
      ],
    }),
    getMemberBudget: builder.query<
      Budget | null,
      { groupId: string; userId: string }
    >({
      query: ({ groupId, userId }) => ({
        url: `groups/${groupId}/members/${userId}/budget`,
      }),
      transformResponse: (response: { budget: Budget | null }) => response.budget,
      providesTags: (_r, _e, arg) => [
        { type: tagTypesEnum.GROUPS, id: `budget-${arg.groupId}-${arg.userId}` },
      ],
    }),
    joinGroup: builder.mutation<GroupWithMembers, { code: string }>({
      query: ({ code }) => ({
        url: 'groups/join',
        method: 'POST',
        body: { code },
      }),
      invalidatesTags: [{ type: tagTypesEnum.GROUPS, id: 'LIST' }],
    }),
    deleteGroup: builder.mutation<void, string>({
      query: groupId => ({
        url: `groups/${groupId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: tagTypesEnum.GROUPS, id: 'LIST' }],
    }),
  }),
});

export const {
  useGetGroupsQuery,
  useCreateGroupMutation,
  useAddGroupMemberMutation,
  useRemoveGroupMemberMutation,
  useGetGroupTransactionsQuery,
  useGetGroupInsightsQuery,
  useGetMemberBudgetQuery,
  useJoinGroupMutation,
  useDeleteGroupMutation,
} = groupApi;
