import {
  API_HEADERS,
  commandChannelSchema,
  type CommandChannel,
  type ModuleKey,
} from "@merchant/contracts";

/**
 * Where a command came from (backend.md 4.1): who asked, through which
 * channel, with which client, and as part of which request or event. An
 * adapter builds it from the session and validated headers; nothing in it is
 * taken from a request body. Use cases pass it on unchanged, and every event
 * they announce carries it.
 */
export type CommandOrigin = {
  actorId?: string;
  /** The event this command reacts to, when an event handler issued it. */
  causationId?: string;
  channel?: CommandChannel;
  clientVersion?: string;
  /** Set only for an authenticated device, never from a header. */
  deviceId?: string;
  /** The request ID; it becomes the correlation ID of the events. */
  requestId?: string;
};

/** A command a signed-in person issued. */
export type ActorCommandOrigin = CommandOrigin & { actorId: string };

type OriginHeaders = {
  [API_HEADERS.clientChannel]?: CommandChannel | undefined;
  [API_HEADERS.clientVersion]?: string | undefined;
  [API_HEADERS.requestId]?: string | undefined;
};

/** For HTTP adapters. A client that does not say what it is counts as a plain API client. */
export function commandOriginFromRequest(
  actorId: string,
  headers: OriginHeaders,
): ActorCommandOrigin {
  const requestId = headers[API_HEADERS.requestId];
  const clientVersion = headers[API_HEADERS.clientVersion];
  return {
    actorId,
    channel: headers[API_HEADERS.clientChannel] ?? "API",
    ...(clientVersion ? { clientVersion } : {}),
    ...(requestId ? { requestId } : {}),
  };
}

/**
 * For event handlers: the command they issue is caused by the event and
 * belongs to the same chain of work. The handler acts as the system, not as
 * the person behind the original request.
 */
export function commandOriginFromEvent(event: {
  channel: string | null;
  clientVersion: string | null;
  correlationId: string | null;
  eventId: string;
}): CommandOrigin {
  const channel = commandChannelSchema.safeParse(event.channel);
  return {
    causationId: event.eventId,
    ...(channel.success ? { channel: channel.data } : {}),
    ...(event.clientVersion ? { clientVersion: event.clientVersion } : {}),
    ...(event.correlationId ? { requestId: event.correlationId } : {}),
  };
}

/** The envelope columns of an outbox event, taken from the command that caused it. */
export function eventOrigin(origin: CommandOrigin | undefined, producer: ModuleKey) {
  return {
    ...(origin?.deviceId
      ? { actorId: origin.deviceId, actorType: "DEVICE" }
      : origin?.actorId
        ? { actorId: origin.actorId, actorType: "USER" }
        : { actorType: "SYSTEM" }),
    ...(origin?.causationId ? { causationId: origin.causationId } : {}),
    ...(origin?.channel ? { channel: origin.channel } : {}),
    ...(origin?.clientVersion ? { clientVersion: origin.clientVersion } : {}),
    ...(origin?.requestId ? { correlationId: origin.requestId } : {}),
    ...(origin?.deviceId ? { deviceId: origin.deviceId } : {}),
    producer,
  };
}
