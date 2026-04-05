import { apiSlice, tagTypesEnum } from './apiSlice';
import type {
  GroupWithMembers,
  CreateGroupPayload,
  Transaction,
  TransactionInsights,
} from '@portfolio/common';

export const groupApi = apiSlice.injectEndpoints({
  endpoints: builder => ({
    getGroups: builder.query<GroupWithMembers[], void>({
      query: () => 'groups',
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
      TransactionInsights,
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
  }),
});

export const {
  useGetGroupsQuery,
  useCreateGroupMutation,
  useAddGroupMemberMutation,
  useRemoveGroupMemberMutation,
  useGetGroupTransactionsQuery,
  useGetGroupInsightsQuery,
} = groupApi;
