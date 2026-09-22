import {
  type BaseQueryFn,
  createApi,
  type FetchArgs,
  type FetchBaseQueryError,
  fetchBaseQuery,
} from '@reduxjs/toolkit/query/react';
import {
  type Application,
  itemResponseSchema,
  listResponseSchema,
  noteResultSchema,
  notesPageSchema,
  type RoleNote,
  type SavedPosting,
  saveResponseSchema,
  type UpdateEntry,
  type UpdateMessage,
  updateHistorySchema,
  updateResultSchema,
} from './job-api.contracts';

const transport = fetchBaseQuery({
  baseUrl: '/api/job-postings',
  timeout: 20_000,
});
const validatedQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extra) => {
  const result = await transport(args, api, extra);
  if (result.error)
    return typeof result.error.status === 'number'
      ? {
          error: {
            status: result.error.status,
            data: { message: 'The request failed.' },
          },
        }
      : { error: { status: 'CUSTOM_ERROR', error: 'The request failed.' } };
  if (api.endpoint === 'deletePosting' || api.endpoint === 'deleteNote')
    return result.meta?.response?.status === 204
      ? { data: null }
      : {
          error: {
            status: 'CUSTOM_ERROR',
            error: 'The API response was invalid.',
          },
        };
  const schema =
    api.endpoint === 'roleNotes'
      ? notesPageSchema
      : ['createNote', 'editNote'].includes(api.endpoint)
        ? noteResultSchema
        : api.endpoint === 'roleUpdates'
          ? updateHistorySchema
          : ['sendRoleUpdate', 'undoRoleUpdate'].includes(api.endpoint)
            ? updateResultSchema
            : api.endpoint === 'postings'
              ? listResponseSchema
              : api.endpoint === 'savePosting'
                ? saveResponseSchema
                : itemResponseSchema;
  const parsed = schema.safeParse(result.data);
  return parsed.success
    ? { data: parsed.data }
    : {
        error: {
          status: 'CUSTOM_ERROR',
          error: 'The API response was invalid.',
        },
      };
};
export const postingApi = createApi({
  reducerPath: 'postingApi',
  baseQuery: validatedQuery,
  tagTypes: ['Posting', 'Updates', 'Notes'],
  endpoints: (build) => ({
    roleNotes: build.infiniteQuery<
      ReturnType<typeof notesPageSchema.parse>,
      string,
      string | null
    >({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
      },
      query: ({ queryArg, pageParam }) => ({
        url: `/${queryArg}/notes`,
        params: pageParam ? { cursor: pageParam } : {},
      }),
      transformResponse: (value: unknown) => notesPageSchema.parse(value),
      providesTags: (_result, _error, id) => [{ type: 'Notes', id }],
    }),
    createNote: build.mutation<
      RoleNote,
      { roleId: string; id: string; body: string }
    >({
      query: ({ roleId, ...body }) => ({
        url: `/${roleId}/notes`,
        method: 'POST',
        body,
      }),
      transformResponse: (value: unknown) => noteResultSchema.parse(value).note,
      invalidatesTags: (_result, _error, { roleId }) => [
        'Posting',
        { type: 'Notes', id: roleId },
      ],
    }),
    editNote: build.mutation<
      RoleNote,
      { roleId: string; noteId: string; body: string; expectedRevision: number }
    >({
      query: ({ roleId, noteId, ...body }) => ({
        url: `/${roleId}/notes/${noteId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (value: unknown) => noteResultSchema.parse(value).note,
      invalidatesTags: (_result, _error, { roleId }) => [
        'Posting',
        { type: 'Notes', id: roleId },
      ],
    }),
    deleteNote: build.mutation<
      null,
      { roleId: string; noteId: string; expectedRevision: number }
    >({
      query: ({ roleId, noteId, ...body }) => ({
        url: `/${roleId}/notes/${noteId}`,
        method: 'DELETE',
        body,
      }),
      invalidatesTags: (_result, _error, { roleId }) => [
        'Posting',
        { type: 'Notes', id: roleId },
      ],
    }),
    roleUpdates: build.infiniteQuery<
      ReturnType<typeof updateHistorySchema.parse>,
      string,
      string | null
    >({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
      },
      query: ({ queryArg, pageParam }) => ({
        url: `/${queryArg}/updates`,
        params: pageParam ? { cursor: pageParam } : {},
      }),
      transformResponse: (value: unknown) => updateHistorySchema.parse(value),
      providesTags: (_result, _error, id) => [{ type: 'Updates', id }],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(postingApi.util.invalidateTags(['Posting']));
        } catch {
          /* History errors are shown in the panel. */
        }
      },
    }),
    sendRoleUpdate: build.mutation<UpdateEntry, UpdateMessage & { id: string }>(
      {
        query: ({ id, ...body }) => ({
          url: `/${id}/updates`,
          method: 'POST',
          body,
        }),
        transformResponse: (value: unknown) =>
          updateResultSchema.parse(value).entry,
        invalidatesTags: (_result, _error, { id }) => [
          { type: 'Updates', id },
          { type: 'Posting', id },
        ],
      },
    ),
    undoRoleUpdate: build.mutation<
      UpdateEntry,
      { id: string; operationId: string }
    >({
      query: ({ id, operationId }) => ({
        url: `/${id}/updates/${operationId}/undo`,
        method: 'POST',
        body: {},
      }),
      transformResponse: (value: unknown) =>
        updateResultSchema.parse(value).entry,
      invalidatesTags: (_result, _error, { id }) => [
        'Posting',
        { type: 'Updates', id },
      ],
    }),
    postings: build.infiniteQuery<
      ReturnType<typeof listResponseSchema.parse>,
      void,
      string | null
    >({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
      },
      query: ({ pageParam }) => ({
        url: '',
        params: { limit: 50, ...(pageParam ? { cursor: pageParam } : {}) },
      }),
      transformResponse: (value: unknown) => listResponseSchema.parse(value),
      providesTags: ['Posting'],
    }),
    posting: build.query<SavedPosting, string>({
      query: (id) => `/${id}`,
      transformResponse: (value: unknown) =>
        itemResponseSchema.parse(value).item,
      providesTags: (_result, _error, id) => [{ type: 'Posting', id }],
    }),
    savePosting: build.mutation<
      ReturnType<typeof saveResponseSchema.parse>,
      {
        url: string;
        application: { interest: Application['interest'] };
        extract: true;
      }
    >({
      query: (body) => ({ url: '', method: 'POST', body }),
      transformResponse: (value: unknown) => saveResponseSchema.parse(value),
      invalidatesTags: ['Posting'],
    }),
    updatePosting: build.mutation<
      SavedPosting,
      {
        id: string;
        expectedApplicationVersion: number;
        changes: Partial<Application>;
      }
    >({
      query: ({ id, ...body }) => ({ url: `/${id}`, method: 'PATCH', body }),
      transformResponse: (value: unknown) =>
        itemResponseSchema.parse(value).item,
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            postingApi.util.upsertQueryEntries([
              { endpointName: 'posting', arg: id, value: data },
            ]),
          );
        } catch {
          /* The mutation error is displayed by its container. */
        }
      },
      invalidatesTags: ['Posting'],
    }),
    deletePosting: build.mutation<
      null,
      { id: string; expectedApplicationVersion: number }
    >({
      query: ({ id, ...body }) => ({ url: `/${id}`, method: 'DELETE', body }),
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(
            postingApi.util.updateQueryData('postings', undefined, (draft) => {
              for (const page of draft.pages)
                page.items = page.items.filter((item) => item.id !== id);
            }),
          );
        } catch {
          /* Keep cached records until deletion is acknowledged. */
        }
      },
      invalidatesTags: ['Posting'],
    }),
    extractPosting: build.mutation<
      SavedPosting,
      { id: string; expectedGeneration: string | null }
    >({
      query: ({ id, ...body }) => ({
        url: `/${id}/extraction`,
        method: 'POST',
        body,
      }),
      transformResponse: (value: unknown) =>
        itemResponseSchema.parse(value).item,
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            postingApi.util.upsertQueryEntries([
              { endpointName: 'posting', arg: id, value: data },
            ]),
          );
        } catch {
          /* The mutation error is displayed by its container. */
        }
      },
      invalidatesTags: ['Posting'],
    }),
  }),
});
export const {
  useRoleNotesInfiniteQuery,
  useCreateNoteMutation,
  useEditNoteMutation,
  useDeleteNoteMutation,
  useRoleUpdatesInfiniteQuery,
  useSendRoleUpdateMutation,
  useUndoRoleUpdateMutation,
  usePostingsInfiniteQuery,
  usePostingQuery,
  useSavePostingMutation,
  useUpdatePostingMutation,
  useExtractPostingMutation,
  useDeletePostingMutation,
} = postingApi;
