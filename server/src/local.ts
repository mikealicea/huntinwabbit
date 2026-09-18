import { buildApp } from './app.ts';

const port = Number(process.env.PORT ?? 3000);

const app = buildApp();

app.listen(port, (): void => {
  console.log(`Server listening on http://localhost:${port}`);
});
