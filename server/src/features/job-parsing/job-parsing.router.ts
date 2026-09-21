import { Router } from 'express';

import { PARSE_TIMEOUT_MS } from './job-parsing.config.ts';
import { parsingError } from './job-parsing.errors.ts';
import {
  type ParsePosting,
  parseRequestSchema,
} from './job-parsing.schemas.ts';

export function createJobParsingRouter(parsePosting?: ParsePosting): Router {
  const router = Router();
  router.post('/job-postings/parse', async (req, res) => {
    if (!req.is('application/json')) {
      const error = parsingError('INVALID_REQUEST');
      res
        .status(415)
        .json({ message: error.message, code: 'UNSUPPORTED_MEDIA_TYPE' });
      return;
    }
    const input = parseRequestSchema.safeParse(req.body);
    if (!input.success) throw parsingError('INVALID_REQUEST');
    if (!parsePosting) throw parsingError('PARSING_DISABLED');
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timer = setTimeout(abort, PARSE_TIMEOUT_MS);
    res.once('close', abort);
    try {
      const result = await parsePosting(input.data.url, controller.signal);
      if (controller.signal.aborted) throw parsingError('PARSE_TIMEOUT');
      res.json(result);
    } catch (cause) {
      if (controller.signal.aborted) throw parsingError('PARSE_TIMEOUT');
      throw cause;
    } finally {
      clearTimeout(timer);
      res.removeListener('close', abort);
    }
  });
  return router;
}
