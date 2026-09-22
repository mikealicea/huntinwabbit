export {
  postingApi,
  useCompaniesInfiniteQuery,
  useCompanyQuery,
  useCompanyRolesInfiniteQuery,
  useDeletePostingMutation,
  useExtractPostingMutation,
  usePostingQuery,
  usePostingsInfiniteQuery,
  useRoleUpdatesInfiniteQuery,
  useSavePostingMutation,
  useSelectCompanyMutation,
  useSendRoleUpdateMutation,
  useUndoRoleUpdateMutation,
  useUpdatePostingMutation,
} from './job-api.client';
export type {
  Company as SavedCompany,
  CompanySelection,
} from './job-api.companies.contracts';
export type {
  Application,
  Job,
  SavedPosting,
  UpdateEntry,
  UpdateMessage,
} from './job-api.contracts';
export { RequestFeedback } from './RequestFeedback.component';
