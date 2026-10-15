"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { KitchenTicket } from "@merchant/contracts";

export type SoundVolume = "high" | "low" | "medium";

/** What this device does when a ticket arrives. Kept in this browser only. */
export type SoundSettings = { muted: boolean; volume: SoundVolume };

const SETTINGS_KEY = "kds.sound";
const DEFAULT_SETTINGS: SoundSettings = { muted: false, volume: "high" };
export const VOLUME_LEVELS: Record<SoundVolume, number> = { high: 1, low: 0.3, medium: 0.6 };

/** How long a ticket that just arrived keeps its ring. */
export const HIGHLIGHT_MS = 30_000;

const SOUND_FILES = {
  connectionLost: "/sounds/kds-connection-lost.wav",
  newTicket: "/sounds/kds-new-ticket.wav",
} as const;

export type KitchenSound = keyof typeof SOUND_FILES;

/** Tells every reader on this page that the settings changed. */
const SETTINGS_EVENT = "kds-sound-settings";

function readStored(): string {
  try {
    return window.localStorage.getItem(SETTINGS_KEY) ?? "";
  } catch {
    // Storage may be unavailable (private window); the defaults apply.
    return "";
  }
}

export function parseSoundSettings(stored: string): SoundSettings {
  try {
    const value = JSON.parse(stored || "null") as unknown;
    if (value && typeof value === "object") {
      const { muted, volume } = value as Partial<SoundSettings>;
      return {
        muted: typeof muted === "boolean" ? muted : DEFAULT_SETTINGS.muted,
        volume: volume && volume in VOLUME_LEVELS ? volume : DEFAULT_SETTINGS.volume,
      };
    }
  } catch {
    // Unreadable: the defaults apply.
  }
  return DEFAULT_SETTINGS;
}

/** Mute and volume for this device, remembered in this browser. */
export function useSoundSettings() {
  const stored = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(SETTINGS_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(SETTINGS_EVENT, onChange);
      };
    },
    readStored,
    () => "",
  );
  const settings = parseSoundSettings(stored);
  const update = useCallback((change: Partial<SoundSettings>) => {
    const next = { ...parseSoundSettings(readStored()), ...change };
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Not remembered; the screen keeps its current settings.
    }
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  }, []);
  return { settings, update };
}

/**
 * Plays the kitchen's sounds at this device's volume. A browser may refuse
 * to play before anyone has touched the page; `blocked` then says so, and
 * `play` from a tap (e.g. "Turn on sound") lifts it.
 */
export function useKitchenSounds(settings: SoundSettings) {
  const [blocked, setBlocked] = useState(false);
  const audio = useRef<Partial<Record<KitchenSound, HTMLAudioElement>>>({});

  const play = useCallback(
    (sound: KitchenSound, force = false) => {
      if (settings.muted && !force) return;
      const element = (audio.current[sound] ??= new Audio(SOUND_FILES[sound]));
      element.volume = VOLUME_LEVELS[settings.volume];
      element.currentTime = 0;
      void element.play().then(
        () => setBlocked(false),
        (error: unknown) => {
          if (error instanceof DOMException && error.name === "NotAllowedError") setBlocked(true);
        },
      );
    },
    [settings.muted, settings.volume],
  );

  return { blocked: blocked && !settings.muted, play };
}

/**
 * The tickets that came in while the screen was open, each for
 * HIGHLIGHT_MS. What was already there when the screen opened is not new.
 * `onArrival` runs once per batch that brings something new.
 */
export function useArrivals(
  tickets: readonly KitchenTicket[] | undefined,
  onArrival: (count: number) => void,
) {
  const seen = useRef<Set<string> | undefined>(undefined);
  const [arrived, setArrived] = useState<ReadonlyMap<string, number>>(new Map());
  const announce = useRef(onArrival);
  useEffect(() => {
    announce.current = onArrival;
  });

  useEffect(() => {
    if (!tickets) return;
    if (!seen.current) {
      seen.current = new Set(tickets.map((ticket) => ticket.id));
      return;
    }
    const known = seen.current;
    const fresh = tickets.filter((ticket) => !known.has(ticket.id));
    if (fresh.length === 0) return;
    for (const ticket of fresh) known.add(ticket.id);
    const now = Date.now();
    setArrived(
      (current) => new Map([...current, ...fresh.map((ticket) => [ticket.id, now] as const)]),
    );
    announce.current(fresh.length);
  }, [tickets]);

  // The ring goes when its time is up.
  useEffect(() => {
    if (arrived.size === 0) return;
    const oldest = Math.min(...arrived.values());
    const timer = window.setTimeout(
      () => {
        const cutoff = Date.now() - HIGHLIGHT_MS;
        setArrived((current) => new Map([...current].filter(([, at]) => at > cutoff)));
      },
      Math.max(0, oldest + HIGHLIGHT_MS - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [arrived]);

  return arrived;
}
