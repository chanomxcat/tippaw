import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueue } from "@/overlay/queue";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createQueue", () => {
  it("plays pushed items in order, one at a time, never overlapping", async () => {
    const order: number[] = [];
    const resolvers: Array<() => void> = [];
    let concurrent = 0;
    let maxConcurrent = 0;

    const play = vi.fn((item: number) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      order.push(item);
      return new Promise<void>((resolve) => {
        resolvers.push(() => {
          concurrent--;
          resolve();
        });
      });
    });

    function resolveAt(i: number): void {
      const resolve = resolvers[i];
      if (!resolve) throw new Error(`expected a resolver at index ${i}`);
      resolve();
    }

    const queue = createQueue(play, { gapMs: 500 });
    queue.push(1);
    queue.push(2);
    queue.push(3);

    // Only the first item starts playing.
    expect(play).toHaveBeenCalledTimes(1);
    expect(order).toEqual([1]);

    resolveAt(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(order).toEqual([1, 2]);

    resolveAt(1);
    await vi.advanceTimersByTimeAsync(500);
    expect(order).toEqual([1, 2, 3]);

    resolveAt(2);
    await vi.advanceTimersByTimeAsync(500);
    expect(maxConcurrent).toBe(1);
  });

  it("skips to the next item when play rejects", async () => {
    const order: number[] = [];
    const play = vi.fn((item: number) => {
      order.push(item);
      return item === 2 ? Promise.reject(new Error("boom")) : Promise.resolve();
    });

    const queue = createQueue(play, { gapMs: 100 });
    queue.push(1);
    queue.push(2);
    queue.push(3);

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);

    expect(order).toEqual([1, 2, 3]);
  });

  it("defaults gapMs to 500", async () => {
    const play = vi.fn(() => Promise.resolve());
    const queue = createQueue(play);
    queue.push(1);
    queue.push(2);

    expect(play).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(499);
    expect(play).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(play).toHaveBeenCalledTimes(2);
  });
});
