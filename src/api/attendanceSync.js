import { api } from './client';

export function isQueuedSync(run) {
  return Boolean(run && (run.queued === true || run.status === 'QUEUED'));
}

/**
 * After Sync now returns a queued job, poll until the office PC finishes.
 * Stops after three minutes so the button cannot stay on Syncing forever.
 */
export async function waitForAttendanceSyncJob(jobId) {
  const deadline = Date.now() + 180_000;
  let last = null;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    last = await api(`/api/hr/attendance/sync/jobs/${jobId}`);
    if (last?.status === 'OK' || last?.status === 'ERROR') {
      return last;
    }
  }
  const error = new Error(
    'Sync is still waiting for the office PC. The button is free again; the board updates when that program finishes.',
  );
  error.pending = true;
  throw error;
}
