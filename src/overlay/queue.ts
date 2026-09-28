/**
 * A simple sequential play queue: items pushed onto it are played one at a
 * time, in order, never overlapping. After each item settles (resolves or
 * rejects), the queue waits `gapMs` before starting the next one. A
 * rejected `play` is swallowed — the queue just moves on to the next item.
 */
export function createQueue<T>(
  play: (item: T) => Promise<void>,
  opts?: { gapMs?: number },
): { push(item: T): void; size(): number } {
  const gapMs = opts?.gapMs ?? 500;
  const pending: T[] = [];
  let playing = false;

  function runNext(): void {
    if (playing) return;
    const item = pending.shift();
    if (item === undefined) return;

    playing = true;
    play(item)
      .catch(() => {
        // Swallow: a rejected item is skipped, not retried.
      })
      .finally(() => {
        setTimeout(() => {
          playing = false;
          runNext();
        }, gapMs);
      });
  }

  return {
    push(item: T): void {
      pending.push(item);
      runNext();
    },
    size(): number {
      return pending.length + (playing ? 1 : 0);
    },
  };
}
