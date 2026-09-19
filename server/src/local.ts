import { buildRuntimeApp } from './runtime.ts';

const port = Number(process.env.PORT ?? 3000);

const app = buildRuntimeApp();

app.listen(port, (): void => {
  console.log(`Server listening on http://localhost:${port}`);
});
