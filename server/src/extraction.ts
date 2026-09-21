// Lambda splits the handler at the first dot; keep the entry filename dot-free.
export {
  extractionHandler as handler,
  recoverExtractions as recover,
} from './features/job-postings/job-postings.index.ts';
