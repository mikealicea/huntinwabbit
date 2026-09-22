export {
  postingApi,
  useCreateNoteMutation,
  useDeleteNoteMutation,
  useDeletePostingMutation,
  useEditNoteMutation,
  useExtractPostingMutation,
  usePostingQuery,
  usePostingsInfiniteQuery,
  useRoleNotesInfiniteQuery,
  useRoleUpdatesInfiniteQuery,
  useSavePostingMutation,
  useSendRoleUpdateMutation,
  useUndoRoleUpdateMutation,
  useUpdatePostingMutation,
} from './job-api.client';
export type {
  Application,
  Job,
  RoleNote,
  SavedPosting,
  UpdateEntry,
  UpdateMessage,
} from './job-api.contracts';
export { RequestFeedback } from './RequestFeedback.component';
