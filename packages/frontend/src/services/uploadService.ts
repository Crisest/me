import { apiSlice } from './apiSlice';
import type { UploadPayloads } from '@portfolio/common';

export const uploadApi = apiSlice.injectEndpoints({
  endpoints: builder => ({
    checkDuplicateUpload: builder.mutation<
      UploadPayloads.CheckDuplicateResponse,
      UploadPayloads.CheckDuplicate
    >({
      query: params => ({
        url: '/uploads/check-duplicate',
        method: 'POST',
        body: params,
      }),
    }),
  }),
});

export const { useCheckDuplicateUploadMutation } = uploadApi;
