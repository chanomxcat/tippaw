import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectOverlay } from "@/overlay/ws-client";

type Listener<E> = ((event: E) => void) | null;

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  url: string;
  sent: string[] = [];
  onopen: Listener<Event> = null;
  onclose: Listener<CloseEvent> = null;
  onmessage: Listener<MessageEvent> = null;
  onerror: Listener<Event> = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    // Real close() doesn't synchronously fire onclose; tests trigger it via simulateClose.
  }

  open(): void {
    this.onopen?.(new Event("open"));
  }

  message(data: string): void {
    this.onmessage?.({ data } as MessageEvent);
  }

  simulateClose(code: number): void {
    this.onclose?.({ code, reason: "" } as CloseEvent);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeWebSocket.instances = [];
});

afterEach(() => {
  vi.useRealTimers();
});

function connect(onEvent = vi.fn(), onStatus = vi.fn()) {
  return connectOverlay({
    url: "wss://example.test/api/realtime/tok",
    onEvent,
    onStatus,
    WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
  });
}

/** The `i`-th `FakeWebSocket` the client has constructed so far (throws if it hasn't yet). */
function socketAt(i: number): FakeWebSocket {
  const ws = FakeWebSocket.instances[i];
  if (!ws) throw new Error(`expected a FakeWebSocket at index ${i}`);
  return ws;
}

describe("connectOverlay", () => {
  it("reconnects with exponential backoff on repeated ordinary closes", async () => {
    connect();
    expect(FakeWebSocket.instances).toHaveLength(1);

    socketAt(0).simulateClose(1006);
    await vi.advanceTimersByTimeAsync(999);
    expect(FakeWebSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances).toHaveLength(2);

    socketAt(1).simulateClose(1006);
    await vi.advanceTimersByTimeAsync(1999);
    expect(FakeWebSocket.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances).toHaveLength(3);

    socketAt(2).simulateClose(1006);
    await vi.advanceTimersByTimeAsync(3999);
    expect(FakeWebSocket.instances).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances).toHaveLength(4);
  });

  it("resets the backoff to 1000ms after a successful open", async () => {
    connect();
    socketAt(0).simulateClose(1006);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);

    socketAt(1).open();
    socketAt(1).simulateClose(1006);
    await vi.advanceTimersByTimeAsync(999);
    expect(FakeWebSocket.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  it("does not reconnect after a 4001 (token reset) close", async () => {
    connect();
    socketAt(0).simulateClose(4001);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("notifies onStatus and onEvent, ignoring 'pong' messages", () => {
    const onEvent = vi.fn();
    const onStatus = vi.fn();
    connect(onEvent, onStatus);

    socketAt(0).open();
    expect(onStatus).toHaveBeenCalledWith("open");

    socketAt(0).message("pong");
    expect(onEvent).not.toHaveBeenCalled();

    const alertEvent = { type: "alert", id: "1" };
    socketAt(0).message(JSON.stringify(alertEvent));
    expect(onEvent).toHaveBeenCalledWith(alertEvent);

    socketAt(0).simulateClose(1006);
    expect(onStatus).toHaveBeenCalledWith("closed");
  });

  it("sends 'ping' every 30 seconds while connected, and stops after close()", async () => {
    const handle = connect();
    socketAt(0).open();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(socketAt(0).sent).toEqual(["ping"]);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(socketAt(0).sent).toEqual(["ping", "ping"]);

    handle.close();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(socketAt(0).sent).toEqual(["ping", "ping"]);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("close() stops reconnect attempts", async () => {
    const handle = connect();
    socketAt(0).simulateClose(1006);
    handle.close();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
