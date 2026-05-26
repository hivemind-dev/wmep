/**
 * @aurorah/wmep-media-player — boundary file
 *
 * THE BOUNDARY FILE for the media-player module.
 *
 * One symbol — `Player` — exported. Declaration merging makes
 * it both the contract (TYPE space) and the factory (VALUE
 * space).
 */

import type { WmepFactory, WmepModule } from "../../src/core/index.js";

import { createPlayer } from "./player.js";

// -----------------------------------------------------------------
// Domain types (shared at the boundary).
// -----------------------------------------------------------------
export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  coverUrl?: string;
  format?: string;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
}

export type PlaybackState = "playing" | "paused" | "stopped" | "buffering";

export type RepeatMode = "off" | "all" | "one";

export interface PlayerStateSnapshot {
  state: PlaybackState;
  currentTrackIndex: number;
  trackId: string | null;
  volume: number;
  repeat: RepeatMode;
  shuffle: boolean;
}

export interface StreamChunk {
  chunk: number;
  bytes: number;
  trackId: string;
}

// -----------------------------------------------------------------
// The contract.
// -----------------------------------------------------------------
export interface Player extends WmepModule<
  // HOST to MODULE: capabilities
  {
    /** Load a playlist by id from the host. */
    loadPlaylist(p: { playlistId: string }): Promise<Playlist>;

    /** Append a track to the current playlist. */
    addTrack(p: { trackId: string }): Promise<void>;

    /** Look up track metadata from the host. */
    getTrackInfo(p: { trackId: string }): Promise<Track>;

    /** Start playing the track at the given index. */
    play(p: { trackIndex: number }): Promise<{ ok: boolean }>;

    /** Request a pause. Takes effect at the next chunk boundary. */
    pause(): void;

    /** Stop playback and reset the cursor. */
    stop(): Promise<void>;

    /** Snapshot of playback state. */
    getState(): PlayerStateSnapshot;

    /** Set the output volume (0..1). */
    setVolume(p: { volume: number }): void;
  },
  // MODULE to HOST: events
  {
    "playback:stateChanged": { state: PlaybackState; trackId: string };
    "playback:progress": {
      trackId: string;
      currentTime: number;
      duration: number;
      percentage: number;
    };
    "track:ended": { trackId: string; nextTrackId: string };
  },
  // HOST to MODULE: listeners
  {
    /** Host signals the active playlist changed externally. */
    "playlist:updated": { playlistId?: string };
  },
  // MODULE to HOST: requires
  {
    /** Host-supplied audit logger. Every state-changing action
     *  funnels through this endpoint, mirroring the counter
     *  example's logging convention. */
    logger: { write(entry: { action: string; detail?: unknown }): void };

    playlist: {
      load(p: { playlistId: string }): Promise<Playlist>;
      add(p: { playlistId: string; trackId: string }): Promise<Playlist>;
      remove(p: { playlistId: string; trackId: string }): Promise<void>;
    };
    track: {
      info(p: { trackId: string }): Promise<Track>;
      /** AsyncIterable of chunks for the named track. */
      stream(p: { trackId: string }): AsyncIterable<StreamChunk>;
    };
  },
  // HOST to MODULE: config
  {
    volume?: number;
    autoplay?: boolean;
    repeat?: RepeatMode;
    shuffle?: boolean;
  }
> {
  /** Identity of this module — overrides the base default. */
  module: { name: "@aurorah/wmep-media-player"; version: "1.0.0" };
}

export const Player: WmepFactory<Player> = createPlayer;
