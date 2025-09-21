import { apiSlice, tagTypesEnum } from './apiSlice';
import type { Card, CreateCardPayload } from '@portfolio/common';

export const cardApi = apiSlice.injectEndpoints({
  endpoints: builder => ({
    getCards: builder.query<Card[], void>({
      query: () => ({
        url: '/cards',
      }),
      providesTags: [tagTypesEnum.CARDS],
    }),
    createCard: builder.mutation<Card, CreateCardPayload>({
      query: card => ({
        url: '/cards',
        method: 'POST',
        body: card,
      }),
      invalidatesTags: [tagTypesEnum.CARDS],
    }),
  }),
});

export const { useGetCardsQuery, useCreateCardMutation } = cardApi;
