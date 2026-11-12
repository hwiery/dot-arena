// Runs the recap on Render Workflows when configured, otherwise in-process.
import { buildRecap, recapSvg } from './recap.js';

export async function runRecap(session, log = () => {}) {
  const slug = process.env.RECAP_TASK; // e.g. dot-arena-recap/sessionRecap
  if (process.env.RENDER_API_KEY && slug) {
    try {
      const { Render } = await import('@renderinc/sdk');
      const run = await new Render().workflows.startTask(slug, [session], {
        idempotencyKey: `${session.code}-${session.startedAt}-${session.rounds.length}`,
      });
      const done = await run.get();
      if (done.status !== 'succeeded' && done.status !== 'completed') throw new Error(done.error || done.status);
      const out = Array.isArray(done.results) ? done.results[0] : done.results;
      return { ...out, via: 'render-workflows', runId: run.taskRunId };
    } catch (err) {
      log('recap.workflow_failed', { error: String(err?.message ?? err) });
    }
  }
  const recap = buildRecap(session);
  return { recap, svg: recapSvg(recap), via: 'local' };
}
