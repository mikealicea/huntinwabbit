import { createHash, randomUUID } from 'node:crypto';
import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { AppError } from '../../shared/shared.errors.ts';
import { sharedFindings, sourceBatches } from './company-analysis.model.ts';
import {
  type AnalysisResponse,
  type Analyze,
  type Finding,
  findingSchema,
  type ReadInputs,
  type State,
  sourceRevisionSchema,
  sourceSchema,
  stateSchema,
} from './company-analysis.schemas.ts';

type Send = (
  command: GetCommand | QueryCommand | TransactWriteCommand,
  signal: AbortSignal,
) => Promise<unknown>;
type Writes = NonNullable<TransactWriteCommandInput['TransactItems']>;
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const pad = (index: number) => String(index).padStart(10, '0');
const sourceKey = (company: string) => `CA-SOURCE#${company}`;
const stateKey = (company: string) => `CA-STATE#${company}`;
const dataPrefix = (state: State) =>
  `CA-DATA#${state.companyId}#${state.generation}#`;
const resultPrefix = (company: string, generation: string) =>
  `CA-RESULT#${company}#${generation}#`;
const taskKey = (state: State) =>
  `CA-JOB#${state.companyId}#${state.generation}#${pad(state.version)}`;
export function analysisError(code: string, status = 503) {
  return new AppError(status, 'Company analysis could not be completed.', {
    code,
  });
}
export function analysisInvalidation(
  table: string,
  pk: string,
  company: string,
  hidden: boolean,
  now: number,
): Writes[number] {
  return {
    Update: {
      TableName: table,
      Key: { pk, sk: sourceKey(company) },
      UpdateExpression: `SET revision = if_not_exists(revision, :zero) + :one, dueGroup = :group, dueAt = :due${hidden ? ', hidden = :hidden' : ''}`,
      ExpressionAttributeValues: {
        ':zero': 0,
        ':one': 1,
        ':group': 'CA_SCHEDULE',
        ':due': now + 60000,
        ...(hidden ? { ':hidden': true } : {}),
      },
    },
  };
}
const taskSchema = z.object({
  pk: z.string(),
  sk: z.string(),
  companyId: z.uuid(),
  generation: z.uuid(),
  version: z.number().int(),
  status: z.enum(['queued', 'claimed', 'complete']),
  dueAt: z.number().optional(),
});
export function createCompanyAnalysis(deps: {
  table: string;
  send: Send;
  enabled: boolean;
  company: (pk: string, id: string, signal: AbortSignal) => Promise<unknown>;
  readInputs?: ReadInputs;
  analyze?: Analyze;
  now?: () => number;
}) {
  const { table, send } = deps;
  const now = deps.now ?? Date.now;
  const signal = () => AbortSignal.timeout(10000);
  async function row(pk: string, sk: string) {
    const result = z
      .object({ Item: z.record(z.string(), z.unknown()).optional() })
      .parse(
        await send(
          new GetCommand({
            TableName: table,
            Key: { pk, sk },
            ConsistentRead: true,
          }),
          signal(),
        ),
      );
    if (result.Item && (result.Item.pk !== pk || result.Item.sk !== sk))
      throw analysisError('INVALID_STORED_ANALYSIS');
    return result.Item;
  }
  async function page(pk: string, prefix: string, limit = 20, after?: string) {
    const result = z
      .object({
        Items: z.array(z.record(z.string(), z.unknown())).default([]),
        LastEvaluatedKey: z
          .object({ pk: z.string(), sk: z.string() })
          .optional(),
      })
      .parse(
        await send(
          new QueryCommand({
            TableName: table,
            ConsistentRead: true,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
            ExpressionAttributeValues: { ':pk': pk, ':prefix': prefix },
            Limit: limit,
            ...(after ? { ExclusiveStartKey: { pk, sk: after } } : {}),
          }),
          signal(),
        ),
      );
    if (
      result.Items.some(
        (item) =>
          item.pk !== pk ||
          typeof item.sk !== 'string' ||
          !item.sk.startsWith(prefix),
      ) ||
      (result.LastEvaluatedKey &&
        (result.LastEvaluatedKey.pk !== pk ||
          !result.LastEvaluatedKey.sk.startsWith(prefix)))
    )
      throw analysisError('INVALID_STORED_ANALYSIS');
    return result;
  }
  function put(
    item: Record<string, unknown>,
    condition?: string,
    values?: Record<string, unknown>,
  ): Writes[number] {
    if (Buffer.byteLength(JSON.stringify(item)) > 256 * 1024)
      throw analysisError('ANALYSIS_TOO_LARGE');
    return {
      Put: {
        TableName: table,
        Item: item,
        ...(condition ? { ConditionExpression: condition } : {}),
        ...(values ? { ExpressionAttributeValues: values } : {}),
      },
    };
  }
  function statePut(next: State, previous?: State) {
    return put(
      next,
      previous
        ? 'generation = :generation AND version = :version'
        : 'attribute_not_exists(pk)',
      previous
        ? { ':generation': previous.generation, ':version': previous.version }
        : undefined,
    );
  }
  function revisionCheck(
    pk: string,
    company: string,
    revision: number,
  ): Writes[number] {
    return {
      ConditionCheck: {
        TableName: table,
        Key: { pk, sk: sourceKey(company) },
        ConditionExpression: 'revision = :revision',
        ExpressionAttributeValues: { ':revision': revision },
      },
    };
  }
  function task(state: State) {
    return put(
      {
        pk: state.pk,
        sk: taskKey(state),
        companyId: state.companyId,
        generation: state.generation,
        version: state.version,
        status: 'queued',
        dueGroup: 'CA_WORK',
        dueAt: now() + 900000,
      },
      'attribute_not_exists(pk)',
    );
  }
  function cleanup(
    pk: string,
    company: string,
    generation: string,
    results: boolean,
  ) {
    return put({
      pk,
      sk: `CA-CLEAN#${company}#${generation}#${results ? 'all' : 'temporary'}`,
      companyId: company,
      generation,
      results,
      dueGroup: 'CA_CLEANUP',
      dueAt: now(),
    });
  }
  async function transact(writes: Writes) {
    await send(new TransactWriteCommand({ TransactItems: writes }), signal());
  }
  async function get(
    pk: string,
    company: string,
    cursor?: string,
  ): Promise<AnalysisResponse> {
    await deps.company(pk, company, signal());
    const sourceValue = await row(pk, sourceKey(company));
    const source = sourceValue
      ? sourceRevisionSchema.parse(sourceValue)
      : undefined;
    const raw = await row(pk, stateKey(company));
    const state = raw ? stateSchema.parse(raw) : undefined;
    const stale = !!state && state.revision !== (source?.revision ?? 0);
    const generation = state?.resultGeneration ?? null;
    const visible = !source?.hidden && generation;
    let after: string | undefined;
    if (cursor) {
      try {
        const input = z
          .object({
            owner: z.string(),
            company: z.uuid(),
            generation: z.uuid(),
            after: z.string(),
          })
          .parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
        if (
          input.owner !== hash(pk) ||
          input.company !== company ||
          input.generation !== generation ||
          !input.after.startsWith(resultPrefix(company, input.generation))
        )
          throw new Error();
        after = input.after;
      } catch {
        throw analysisError('ANALYSIS_CHANGED', 409);
      }
    }
    const results = visible
      ? await page(pk, resultPrefix(company, generation), 20, after)
      : { Items: [], LastEvaluatedKey: undefined };
    // A concurrent deletion/move must not expose a now-hidden cached result.
    const latest = await row(pk, sourceKey(company));
    if (latest?.revision !== source?.revision)
      throw analysisError('ANALYSIS_CHANGED', 409);
    return {
      schemaVersion: 1,
      status: !deps.enabled
        ? 'disabled'
        : source?.dueAt !== undefined
          ? 'scheduled'
          : (state?.status ?? 'not-started'),
      generation: state?.generation ?? null,
      stale: stale || (!!state && state.status !== 'complete' && !!generation),
      totalRoles: visible
        ? (state?.resultTotal ?? 0)
        : (state?.totalRoles ?? 0),
      analyzedRoles: visible
        ? (state?.resultRoles ?? 0)
        : (state?.analyzedRoles ?? 0),
      completedAt: visible ? (state?.resultCompletedAt ?? null) : null,
      progress: state?.progress ?? 0,
      error: state?.error ?? null,
      items: results.Items.map((item) => findingSchema.parse(item.finding)),
      nextCursor: results.LastEvaluatedKey
        ? Buffer.from(
            JSON.stringify({
              owner: hash(pk),
              company,
              generation,
              after: results.LastEvaluatedKey.sk,
            }),
          ).toString('base64url')
        : null,
    };
  }
  async function start(
    pk: string,
    company: string,
    force: boolean,
    receipt?: Record<string, unknown>,
  ) {
    const value = await row(pk, sourceKey(company));
    const source = value ? sourceRevisionSchema.parse(value) : undefined;
    const raw = await row(pk, stateKey(company));
    const old = raw ? stateSchema.parse(raw) : undefined;
    if (
      old &&
      old.revision === (source?.revision ?? 0) &&
      (old.status === 'processing' || (!force && source?.dueAt === undefined))
    ) {
      if (receipt) await transact([put(receipt, 'attribute_not_exists(pk)')]);
      return;
    }
    const next: State = {
      pk,
      sk: stateKey(company),
      companyId: company,
      generation: randomUUID(),
      revision: source?.revision ?? 0,
      version: 0,
      status: 'processing',
      phase: 'snapshot',
      cursor: null,
      count: 0,
      index: 0,
      level: 0,
      outputCount: 0,
      totalRoles: 0,
      analyzedRoles: 0,
      progress: 0,
      completedAt: null,
      error: null,
      resultGeneration: source?.hidden ? null : (old?.resultGeneration ?? null),
      resultCount: old?.resultCount ?? 0,
      resultRoles: old?.resultRoles ?? 0,
      resultTotal: old?.resultTotal ?? 0,
      resultCompletedAt: old?.resultCompletedAt ?? null,
    };
    const writes: Writes = [
      put(
        {
          pk,
          sk: sourceKey(company),
          revision: next.revision,
          hidden: source?.hidden ?? false,
        },
        source ? 'revision = :revision' : 'attribute_not_exists(pk)',
        source ? { ':revision': source.revision } : undefined,
      ),
      statePut(next, old),
      task(next),
    ];
    if (receipt) writes.push(put(receipt, 'attribute_not_exists(pk)'));
    if (old)
      writes.push(
        cleanup(
          pk,
          company,
          old.generation,
          old.generation !== next.resultGeneration,
        ),
      );
    if (
      source?.hidden &&
      old?.resultGeneration &&
      old.resultGeneration !== old.generation
    )
      writes.push(cleanup(pk, company, old.resultGeneration, true));
    try {
      await transact(writes);
    } catch (cause) {
      const current = await row(pk, stateKey(company));
      if (current?.generation === next.generation) return;
      throw cause;
    }
  }
  async function request(
    pk: string,
    company: string,
    input: { operationId: string; intent: 'ensure' | 'refresh' },
  ) {
    await deps.company(pk, company, signal());
    if (!deps.enabled) return get(pk, company);
    const key = `CA-REQUEST#${company}#${input.operationId}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      const previous = await row(pk, key);
      if (previous) {
        if (previous.intent !== input.intent)
          throw analysisError('CONFLICT', 409);
        return get(pk, company);
      }
      const receipt = {
        pk,
        sk: key,
        intent: input.intent,
        expiresAt: Math.floor(now() / 1000) + 7 * 86400,
      };
      try {
        if (input.intent === 'ensure') {
          const existing = await row(pk, sourceKey(company));
          await transact([
            put(receipt, 'attribute_not_exists(pk)'),
            ...(!existing
              ? [
                  put(
                    {
                      pk,
                      sk: sourceKey(company),
                      revision: 0,
                      hidden: false,
                      dueGroup: 'CA_SCHEDULE',
                      dueAt: now() + 60000,
                    },
                    'attribute_not_exists(pk)',
                  ),
                ]
              : []),
          ]);
        } else await start(pk, company, true, receipt);
        return get(pk, company);
      } catch (cause) {
        if (attempt === 2 && !(await row(pk, key))) throw cause;
      }
    }
    return get(pk, company);
  }
  async function node(state: State, level: number, index: number) {
    const value = await row(
      state.pk,
      `${dataPrefix(state)}NODE#${pad(level)}#${pad(index)}`,
    );
    if (!value) throw analysisError('INVALID_STORED_ANALYSIS');
    return z.array(findingSchema).parse(value.findings);
  }
  function nodePut(
    state: State,
    level: number,
    index: number,
    findings: Finding[],
  ) {
    return put({
      pk: state.pk,
      sk: `${dataPrefix(state)}NODE#${pad(level)}#${pad(index)}`,
      findings,
      expiresAt: Math.floor(now() / 1000) + 7 * 86400,
    });
  }
  async function finishTask(state: State, next: State, writes: Writes) {
    const terminal = next.status !== 'processing';
    await transact(
      [
        next.status === 'complete'
          ? {
              Update: {
                TableName: table,
                Key: { pk: state.pk, sk: sourceKey(state.companyId) },
                UpdateExpression: 'SET hidden = :false',
                ConditionExpression: 'revision = :revision',
                ExpressionAttributeValues: {
                  ':false': false,
                  ':revision': state.revision,
                },
              },
            }
          : revisionCheck(state.pk, state.companyId, state.revision),
        statePut(next, state),
        put(
          {
            pk: state.pk,
            sk: taskKey(state),
            companyId: state.companyId,
            generation: state.generation,
            version: state.version,
            status: 'complete',
            expiresAt: Math.floor(now() / 1000) + 7 * 86400,
          },
          '#status = :claimed',
          { ':claimed': 'claimed' },
        ),
        ...writes,
        ...(!terminal
          ? [task(next)]
          : [
              cleanup(
                state.pk,
                state.companyId,
                state.generation,
                next.status === 'failed',
              ),
            ]),
      ].map((write) => {
        if (write.Put?.ConditionExpression === '#status = :claimed')
          write.Put.ExpressionAttributeNames = { '#status': 'status' };
        return write;
      }),
    );
  }
  async function run(pk: string, sk: string) {
    const raw = await row(pk, sk);
    if (!raw) return;
    const job = taskSchema.parse(raw);
    if (job.status !== 'queued') return;
    const stateValue = await row(pk, stateKey(job.companyId));
    if (!stateValue) return;
    const state = stateSchema.parse(stateValue);
    if (
      state.generation !== job.generation ||
      state.version !== job.version ||
      state.status !== 'processing' ||
      taskKey(state) !== sk
    )
      return;
    const source = sourceRevisionSchema.parse(
      await row(pk, sourceKey(state.companyId)),
    );
    if (source.revision !== state.revision) return;
    if (!deps.enabled || !deps.readInputs || !deps.analyze) {
      await fail(state, 'ANALYSIS_DISABLED');
      return;
    }
    try {
      await transact([
        revisionCheck(pk, state.companyId, state.revision),
        {
          Put: {
            TableName: table,
            Item: { ...raw, status: 'claimed', dueAt: now() + 180000 },
            ConditionExpression: '#status = :queued',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':queued': 'queued' },
          },
        },
      ]);
    } catch {
      return;
    } // An uncertain claim never authorizes a paid request.
    try {
      const next = {
        ...state,
        version: state.version + 1,
        progress: state.progress + 1,
      };
      const writes: Writes = [];
      if (state.phase === 'snapshot') {
        const input = await deps.readInputs(
          pk,
          state.companyId,
          state.cursor,
          AbortSignal.timeout(45000),
        );
        const batches = sourceBatches(input.sources);
        if (batches.length > 90) throw analysisError('ANALYSIS_TOO_LARGE');
        batches.forEach((sources, i) => {
          writes.push(
            put({
              pk,
              sk: `${dataPrefix(state)}INPUT#${pad(state.count + i)}`,
              sources,
              expiresAt: Math.floor(now() / 1000) + 7 * 86400,
            }),
          );
        });
        next.count += batches.length;
        next.cursor = input.cursor;
        next.totalRoles += input.roles;
        next.analyzedRoles += input.usable;
        if (!input.cursor) {
          next.phase = next.analyzedRoles ? 'map' : 'publish';
          next.index = 0;
          if (!next.analyzedRoles) next.count = 0;
        }
      } else if (state.phase === 'map') {
        if (state.index < state.count) {
          const value = await row(
            pk,
            `${dataPrefix(state)}INPUT#${pad(state.index)}`,
          );
          const sources = z.array(sourceSchema).parse(value?.sources);
          const findings = await deps.analyze(
            { sources },
            AbortSignal.timeout(45000),
          );
          writes.push(nodePut(state, 0, state.index, findings));
          next.index++;
        }
        if (next.index === state.count) {
          next.phase = state.count > 1 ? 'reduce' : 'publish';
          next.index = 0;
        }
      } else if (state.phase === 'reduce') {
        const left = await node(state, state.level, state.index);
        const right =
          state.index + 1 < state.count
            ? await node(state, state.level, state.index + 1)
            : [];
        const candidates = [...left, ...right];
        if (
          candidates.length > 200 ||
          Buffer.byteLength(
            JSON.stringify(candidates.map(({ evidence: _e, ...rest }) => rest)),
          ) > 60000
        )
          throw analysisError('ANALYSIS_TOO_LARGE');
        const merged =
          left.length && right.length
            ? await deps.analyze(
                { findings: candidates },
                AbortSignal.timeout(45000),
              )
            : candidates;
        writes.push(nodePut(state, state.level + 1, state.outputCount, merged));
        next.index += 2;
        next.outputCount++;
        if (next.index >= state.count) {
          next.count = next.outputCount;
          next.outputCount = 0;
          next.index = 0;
          next.level++;
          if (next.count <= 1) next.phase = 'publish';
        }
      } else {
        const findings = state.count
          ? sharedFindings(
              await node(state, state.level, 0),
              state.analyzedRoles,
            )
          : [];
        // Publish result rows in bounded pages, then atomically expose the generation.
        const slice = findings.slice(state.index, state.index + 80);
        slice.forEach((finding, i) => {
          writes.push(
            put({
              pk,
              sk: `${resultPrefix(state.companyId, state.generation)}${pad(state.index + i)}`,
              finding,
            }),
          );
        });
        next.index += slice.length;
        if (next.index >= findings.length) {
          next.status = 'complete';
          next.completedAt = new Date(now()).toISOString();
          next.resultGeneration = state.generation;
          next.resultCount = findings.length;
          next.resultRoles = state.analyzedRoles;
          next.resultTotal = state.totalRoles;
          next.resultCompletedAt = next.completedAt;
          if (state.resultGeneration)
            writes.push(
              cleanup(pk, state.companyId, state.resultGeneration, true),
            );
        }
      }
      await finishTask(state, next, writes);
    } catch (cause) {
      await fail(
        state,
        cause instanceof AppError
          ? (cause.code ?? 'ANALYSIS_FAILED')
          : 'ANALYSIS_FAILED',
      );
    }
  }
  async function fail(state: State, error: string) {
    const current = await row(state.pk, stateKey(state.companyId));
    if (
      current?.generation !== state.generation ||
      current.version !== state.version
    )
      return;
    await transact([
      statePut(
        { ...state, version: state.version + 1, status: 'failed', error },
        state,
      ),
      cleanup(state.pk, state.companyId, state.generation, true),
    ]);
  }
  async function clean(value: Record<string, unknown>) {
    const item = z
      .object({
        pk: z.string(),
        sk: z.string(),
        companyId: z.uuid(),
        generation: z.uuid(),
        results: z.boolean(),
      })
      .parse(value);
    for (const prefix of [
      `CA-DATA#${item.companyId}#${item.generation}#`,
      ...(item.results ? [resultPrefix(item.companyId, item.generation)] : []),
    ]) {
      const rows = await page(item.pk, prefix, 50);
      if (rows.Items.length) {
        await transact(
          rows.Items.map((row) => ({
            Delete: { TableName: table, Key: { pk: item.pk, sk: row.sk } },
          })),
        );
        return;
      }
    }
    await transact([
      { Delete: { TableName: table, Key: { pk: item.pk, sk: item.sk } } },
    ]);
  }
  async function recover() {
    for (const group of ['CA_SCHEDULE', 'CA_WORK', 'CA_CLEANUP']) {
      const response = z
        .object({
          Items: z.array(z.record(z.string(), z.unknown())).default([]),
        })
        .parse(
          await send(
            new QueryCommand({
              TableName: table,
              IndexName: 'PendingJobs',
              KeyConditionExpression: 'dueGroup = :group AND dueAt <= :now',
              ExpressionAttributeValues: { ':group': group, ':now': now() },
              Limit: 20,
            }),
            signal(),
          ),
        );
      for (const item of response.Items) {
        const key = z.object({ pk: z.string(), sk: z.string() }).parse(item);
        const current = await row(key.pk, key.sk);
        if (
          !current ||
          typeof current.dueAt !== 'number' ||
          current.dueAt > now()
        )
          continue;
        if (group === 'CA_CLEANUP') {
          await clean(current);
          continue;
        }
        if (group === 'CA_SCHEDULE') {
          if (deps.enabled && key.sk.startsWith('CA-SOURCE#'))
            await start(key.pk, key.sk.slice('CA-SOURCE#'.length), false);
          continue;
        }
        const task = taskSchema.parse(current);
        const stateValue = await row(key.pk, stateKey(task.companyId));
        if (stateValue) {
          const state = stateSchema.parse(stateValue);
          if (
            state.status === 'processing' &&
            state.generation === task.generation &&
            state.version === task.version
          )
            await fail(state, 'ANALYSIS_INTERRUPTED');
        }
        const { dueGroup: _group, dueAt: _due, ...terminal } = current;
        await transact([
          put({ ...terminal, expiresAt: Math.floor(now() / 1000) + 7 * 86400 }),
        ]);
      }
    }
  }
  return { get, request, run, recover };
}
export type CompanyAnalysis = ReturnType<typeof createCompanyAnalysis>;
