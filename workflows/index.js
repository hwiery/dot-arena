// Render Workflow service: builds the recap after a live session.
// sessionRecap fans out one analyzeRound run per round, then assembles the card.
// Start command on Render: node workflows/index.js
import { task } from '@renderinc/sdk/workflows';
import { analyzeRound, buildRecap, recapSvg } from '../src/recap.js';

const analyze = task(
  { name: 'analyzeRound', retry: { maxRetries: 2, waitDurationMs: 500, backoffScaling: 2 }, timeoutSeconds: 60 },
  function analyzeRoundTask(ctx, round) {
    return analyzeRound(round);
  },
);

task(
  { name: 'sessionRecap', retry: { maxRetries: 2, waitDurationMs: 1000, backoffScaling: 2 }, timeoutSeconds: 300 },
  async function sessionRecap(ctx, session) {
    const headlines = await Promise.all(session.rounds.map((r) => ctx.run(analyze, r)));
    const recap = buildRecap(session, headlines);
    return { recap, svg: recapSvg(recap), runId: ctx.metadata?.taskRunId ?? null };
  },
);
