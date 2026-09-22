export type { CompanyAnalysis } from './job-api.analysis.contracts';
export {
  postingApi,
  useCompaniesInfiniteQuery,
  useCompanyAnalysisInfiniteQuery,
  useCompanyNotesInfiniteQuery,
  useCompanyQuery,
  useCompanyRolesInfiniteQuery,
  useCreateCompanyNoteMutation,
  useCreateNoteMutation,
  useDeleteCompanyNoteMutation,
  useDeleteNoteMutation,
  useDeletePostingMutation,
  useEditCompanyNoteMutation,
  useEditNoteMutation,
  useExtractPostingMutation,
  usePostingQuery,
  usePostingsInfiniteQuery,
  useRequestCompanyAnalysisMutation,
  useRoleNotesInfiniteQuery,
  useRoleUpdatesInfiniteQuery,
  useSavePostingMutation,
  useSelectCompanyMutation,
  useSendRoleUpdateMutation,
  useSourceGuidanceQuery,
  useSourceTextQuery,
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
  RoleNote,
  SavedPosting,
  UpdateEntry,
  UpdateMessage,
} from './job-api.contracts';
export { sourceTextSchema } from './job-api.contracts';
export { RequestFeedback } from './RequestFeedback.component';
