let pending = Promise.resolve();
/** One preview task at a time prevents many simultaneous full-size decodes/workers. */
export function queuePreview(work: () => Promise<void>) {
  const next = pending.then(work);
  pending = next.catch(() => {});
  return next;
}
