import { describe, expect, it, vi } from "vitest";

import { safeWebSocketClose } from "@/server/realtime/safe-close";

/** A minimal stand-in for the Workers WebSocket type — only `close()` matters here. */
function fakeSocket(closeImpl: (code?: number, reason?: string) => void) {
  return { close: vi.fn(closeImpl) } as unknown as WebSocket;
}

describe("safeWebSocketClose", () => {
  it("closes normally with the given code when the socket accepts it", () => {
    const close = vi.fn();
    const ws = fakeSocket(close);
    safeWebSocketClose(ws, 1000, "bye");
    expect(close).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith(1000, "bye");
  });

  it("falls back to 1000 when the reported code is reserved (e.g. 1005) and ws.close throws for it", () => {
    const close = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new RangeError("invalid close code");
      })
      .mockImplementationOnce(() => {});
    const ws = fakeSocket(close);

    expect(() => safeWebSocketClose(ws, 1005, "no status")).not.toThrow();
    expect(close).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenNthCalledWith(1, 1005, "no status");
    expect(close).toHaveBeenNthCalledWith(2, 1000, "no status");
  });

  it("swallows the error if even the 1000 fallback throws (socket already closed)", () => {
    const close = vi.fn().mockImplementation(() => {
      throw new Error("already closed");
    });
    const ws = fakeSocket(close);

    expect(() => safeWebSocketClose(ws, 1006, "abnormal")).not.toThrow();
    expect(close).toHaveBeenCalledTimes(2);
  });
});
