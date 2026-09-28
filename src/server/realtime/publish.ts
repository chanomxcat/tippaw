import type { AppEnv } from "@/server/env";
import type { RealtimeEvent } from "@/server/realtime/events";
import { roomFor } from "@/server/realtime/streamer-room";

/** Broadcasts `event` to every overlay currently connected to `streamerId`'s realtime room. */
export async function publish(
  env: AppEnv,
  streamerId: string,
  event: RealtimeEvent,
): Promise<void> {
  const room = roomFor(env.STREAMER_ROOM, streamerId);
  await room.broadcast(event);
}

/** Closes any overlay sockets connected with `token` (e.g. after the token is rotated). */
export async function disconnectToken(
  env: AppEnv,
  streamerId: string,
  token: string,
): Promise<void> {
  const room = roomFor(env.STREAMER_ROOM, streamerId);
  await room.disconnectToken(token);
}
