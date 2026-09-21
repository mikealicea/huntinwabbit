import { Router } from 'express';

export function createHelloRouter(): Router {
  const router = Router();

  router.get('/', (_req, res): void => {
    res.json({ message: 'Hello, world!' });
  });

  return router;
}
