/**
 * @aurorah/wmep-media-player — internal implementation
 *
 * INTERNAL implementation of the media-player module.
 *
 * Owns playback state. Reads chunks from the host's
 * `requires.track.stream(...)` AsyncIterable, emits progress
 * events, and respects pause / stop requests at chunk
 * boundaries.
 *
 * All event/listener plumbing lives in `createWmepModule`.
 */

import { createWmepModule } from "../../src/core/index.js";
import type {
  PlaybackState,
  Player,
  Playlist,
  RepeatMode,
  Track,
} from "./player.wmep.js";

export const createPlayer = createWmepModule<Player>(
  ({ requires, config, emit }) => {
    // ---------------------------------------------------------------
    // Private playback state.
    //
    // Everything below is captured by the closures in the returned
    // object. The host can only read it through `getState`.
    // ---------------------------------------------------------------
    let playlist: Playlist | null = null;
    let currentTrackIndex = -1;
    let state: PlaybackState = "stopped";
    let volume = config.volume ?? 0.8;
    const autoplay = config.autoplay ?? false;
    let repeat: RepeatMode = config.repeat ?? "off";
    let shuffle = config.shuffle ?? false;
    let shuffledOrder: number[] = [];

    // Playback session control. A session is the lifetime of a
    // single track's stream consumption.
    let pauseRequested = false;
    let abortPlayback = false;
    let sessionPromise: Promise<void> | null = null;

    // ---------------------------------------------------------------
    // Source tag for the structured logger.
    //
    // Every state-changing action funnels through requires.logger
    // with a `source` discriminator, mirroring the counter
    // example's `bump | reset | reset-on-request | interval-tick`.
    // ---------------------------------------------------------------
    type PlayerSource =
      | "loadPlaylist"
      | "addTrack"
      | "getTrackInfo"
      | "play"
      | "pause"
      | "stop"
      | "setVolume"
      | "playback:stateChanged"
      | "playback:progress"
      | "track:ended"
      | "playlist:updated";

    const log = (
      action: string,
      source: PlayerSource,
      extra?: Record<string, unknown>,
    ): void => {
      requires.logger.write({
        action,
        detail: { source, ...extra },
      });
    };

    // ---------------------------------------------------------------
    // Internal helpers.
    // ---------------------------------------------------------------
    const currentTrack = (): Track | undefined => {
      if (!playlist || currentTrackIndex < 0) return undefined;
      return playlist.tracks[currentTrackIndex];
    };

    const setState = (next: PlaybackState): void => {
      state = next;
      const trackId = currentTrack()?.id ?? "";
      log("player:stateChange", "playback:stateChanged", {
        state: next,
        trackId,
      });
      emit("playback:stateChanged", { state: next, trackId });
    };

    const rebuildShuffleOrder = (): void => {
      if (!playlist) {
        shuffledOrder = [];
        return;
      }
      shuffledOrder = playlist.tracks.map((_, i) => i);
      if (!shuffle) return;
      // Fisher–Yates.
      for (let i = shuffledOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledOrder[i], shuffledOrder[j]] = [
          shuffledOrder[j],
          shuffledOrder[i],
        ];
      }
    };

    const haltSession = async (): Promise<void> => {
      abortPlayback = true;
      pauseRequested = false;
      if (sessionPromise) await sessionPromise;
      abortPlayback = false;
    };

    const advanceAfterTrackEnd = (): number | null => {
      if (!playlist) return null;
      if (repeat === "one") return currentTrackIndex;
      if (repeat === "off") return null;
      if (shuffle && shuffledOrder.length) {
        let pos = shuffledOrder.indexOf(currentTrackIndex);
        if (pos < 0) pos = 0;
        if (pos < shuffledOrder.length - 1) return shuffledOrder[pos + 1];
        return shuffledOrder[0];
      }
      const next = currentTrackIndex + 1;
      if (next < playlist.tracks.length) return next;
      return playlist.tracks.length > 0 ? 0 : null;
    };

    const runPlaybackSession = async (): Promise<void> => {
      const track = currentTrack();
      if (!track || !playlist) return;

      pauseRequested = false;
      setState("buffering");

      const duration = track.duration;

      try {
        // MODULE to HOST (requires): drain the host-provided
        // AsyncIterable. The stream() call returns the iterable
        // synchronously (it's an async generator factory).
        const stream = requires.track.stream({ trackId: track.id });

        setState("playing");

        let step = 0;
        const totalChunks = 3;
        for await (const _ of stream) {
          // Stop / unmount short-circuit.
          if (abortPlayback) return;
          // Pause control acts on chunk boundaries.
          if (pauseRequested) {
            pauseRequested = false;
            setState("paused");
            return;
          }
          step += 1;
          const currentTime = (duration / totalChunks) * step;
          const percentage = Math.round((step / totalChunks) * 100);
          log("player:progress", "playback:progress", {
            trackId: track.id,
            currentTime,
            duration,
            percentage,
          });
          emit("playback:progress", {
            trackId: track.id,
            currentTime,
            duration,
            percentage,
          });
        }
      } catch (e) {
        console.error("[Player] track.stream error", e);
        setState("stopped");
        return;
      }

      if (abortPlayback) return;

      const nextIdx = currentTrackIndex + 1;
      const nextId = playlist.tracks[nextIdx]?.id ?? "";
      log("player:trackEnded", "track:ended", {
        trackId: track.id,
        nextTrackId: nextId,
      });
      emit("track:ended", { trackId: track.id, nextTrackId: nextId });

      const next = advanceAfterTrackEnd();
      if (next !== null) {
        currentTrackIndex = next;
        sessionPromise = runPlaybackSession();
        await sessionPromise;
      } else {
        setState("stopped");
      }
    };

    const startSession = (): void => {
      sessionPromise = runPlaybackSession();
      void sessionPromise.finally(() => {
        sessionPromise = null;
      });
    };

    return {
      // HOST to MODULE: capabilities.
      capabilities: {
        loadPlaylist: async ({ playlistId }) => {
          playlist = await requires.playlist.load({ playlistId });
          rebuildShuffleOrder();
          currentTrackIndex = -1;
          log("player:loadPlaylist", "loadPlaylist", {
            playlistId,
            tracks: playlist.tracks.length,
          });
          setState("stopped");
          if (autoplay && playlist.tracks.length > 0) {
            await haltSession();
            currentTrackIndex = 0;
            startSession();
          }
          return playlist;
        },

        addTrack: async ({ trackId }) => {
          if (!playlist) throw new Error("No playlist loaded");
          playlist = await requires.playlist.add({
            playlistId: playlist.id,
            trackId,
          });
          rebuildShuffleOrder();
          log("player:addTrack", "addTrack", { trackId });
        },

        getTrackInfo: async ({ trackId }) => {
          const t = await requires.track.info({ trackId });
          log("player:getTrackInfo", "getTrackInfo", { trackId });
          return t;
        },

        play: async ({ trackIndex }) => {
          if (
            !playlist ||
            trackIndex < 0 ||
            trackIndex >= playlist.tracks.length
          ) {
            return { ok: false };
          }
          await haltSession();
          currentTrackIndex = trackIndex;
          log("player:play", "play", {
            trackIndex,
            trackId: playlist.tracks[trackIndex]?.id,
          });
          startSession();
          return { ok: true };
        },

        pause: () => {
          if (state === "playing" || state === "buffering") {
            pauseRequested = true;
            log("player:pause", "pause", {
              trackId: currentTrack()?.id ?? null,
            });
          }
        },

        stop: async () => {
          await haltSession();
          const wasTrack = currentTrack()?.id ?? null;
          currentTrackIndex = -1;
          log("player:stop", "stop", { trackId: wasTrack });
          setState("stopped");
        },

        getState: () => ({
          state,
          currentTrackIndex,
          trackId: currentTrack()?.id ?? null,
          volume,
          repeat,
          shuffle,
        }),

        setVolume: ({ volume: next }) => {
          volume = next;
          log("player:setVolume", "setVolume", { volume });
        },
      },

      // HOST to MODULE: listener handlers.
      listeners: {
        "playlist:updated": ({ playlistId }) => {
          const id = playlistId ?? playlist?.id;
          if (!id) return;
          log("player:playlistUpdated", "playlist:updated", { playlistId: id });
          // Reload in the background — listener handlers are
          // fire-and-forget by convention.
          void (async () => {
            try {
              await haltSession();
              const fresh = await requires.playlist.load({ playlistId: id });
              playlist = fresh;
              rebuildShuffleOrder();
              if (currentTrackIndex >= playlist.tracks.length) {
                currentTrackIndex =
                  playlist.tracks.length > 0 ? playlist.tracks.length - 1 : -1;
              }
              setState("stopped");
            } catch (e) {
              console.error("[Player] playlist:updated refresh failed", e);
            }
          })();
        },
      },

      // ---------------------------------------------------------------
      // Lifecycle.
      //
      // Cleanup makes sure that any in-flight playback session is
      // halted on unmount so the AsyncIterable can be released.
      // ---------------------------------------------------------------
      onMount: () => {
        requires.logger.write({
          action: "player:mount",
          detail: { volume, autoplay, repeat, shuffle },
        });
        return async () => {
          await haltSession();
          requires.logger.write({ action: "player:unmount" });
        };
      },
    };
  },
);
