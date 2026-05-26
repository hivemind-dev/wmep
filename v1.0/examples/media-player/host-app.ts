/**
 * Media Player example — Host-side integration
 *
 * Demonstrates wMEP with an AsyncIterable requires endpoint
 * (`track.stream`) feeding the module's playback loop, plus
 * progress/end events and a listener for playlist updates.
 *
 * Run:
 *   npx tsx examples/media-player/host-app.ts
 */

import { Player } from "./player.wmep.js";
import type { StreamChunk, Track } from "./player.wmep.js";

async function run(): Promise<void> {
  console.log("=== wMEP Media Player Example ===\n");

  // ---------------------------------------------------------------
  // Host-side track/playlist database (mock).
  // ---------------------------------------------------------------
  const trackDb = new Map<string, Track>();
  trackDb.set("t-1", {
    id: "t-1",
    title: "Protocol Blues",
    artist: "The Connectors",
    album: "wMEP Vol. 1",
    duration: 240,
    format: "mp3",
  });
  trackDb.set("t-2", {
    id: "t-2",
    title: "Manifest Destiny",
    artist: "Schema Band",
    album: "wMEP Vol. 1",
    duration: 185,
    format: "mp3",
  });
  trackDb.set("t-3", {
    id: "t-3",
    title: "Stream of Consciousness",
    artist: "Async Await",
    album: "Event Loop",
    duration: 320,
    format: "flac",
  });
  trackDb.set("t-4", {
    id: "t-4",
    title: "Capability Anthem",
    artist: "The Connectors",
    album: "wMEP Vol. 1",
    duration: 200,
    format: "mp3",
  });

  const playlists = new Map<
    string,
    { id: string; name: string; trackIds: string[] }
  >();
  playlists.set("pl-1", {
    id: "pl-1",
    name: "wMEP Greatest Hits",
    trackIds: ["t-1", "t-2", "t-3"],
  });

  // ---------------------------------------------------------------
  // HOST to MODULE: construction.
  // ---------------------------------------------------------------
  const player = Player(
    {
      logger: {
        write: (entry) =>
          console.log(`[Module] ${entry.action}`, entry.detail ?? ""),
      },
      playlist: {
        load: async ({ playlistId }) => {
          const pl = playlists.get(playlistId);
          if (!pl) throw new Error(`Playlist not found: ${playlistId}`);
          return {
            id: pl.id,
            name: pl.name,
            tracks: pl.trackIds
              .map((id) => trackDb.get(id))
              .filter((t): t is Track => Boolean(t)),
          };
        },

        add: async ({ playlistId, trackId }) => {
          const pl = playlists.get(playlistId);
          if (!pl) throw new Error(`Playlist not found: ${playlistId}`);
          pl.trackIds.push(trackId);
          return {
            id: pl.id,
            name: pl.name,
            tracks: pl.trackIds
              .map((id) => trackDb.get(id))
              .filter((t): t is Track => Boolean(t)),
          };
        },

        remove: async ({ playlistId, trackId }) => {
          const pl = playlists.get(playlistId);
          if (!pl) throw new Error(`Playlist not found: ${playlistId}`);
          pl.trackIds = pl.trackIds.filter((id) => id !== trackId);
        },
      },

      track: {
        info: async ({ trackId }) => {
          const track = trackDb.get(trackId);
          if (!track) throw new Error(`Track not found: ${trackId}`);
          return track;
        },

        stream: async function* ({ trackId }): AsyncIterable<StreamChunk> {
          const track = trackDb.get(trackId);
          if (!track) throw new Error(`Track not found: ${trackId}`);
          for (let i = 0; i < 3; i++) {
            yield { chunk: i, bytes: 65_536, trackId: track.id };
          }
        },
      },
    },
    { volume: 0.7, autoplay: false, repeat: "off", shuffle: false },
  );

  // ---------------------------------------------------------------
  // MODULE to HOST: lifecycle + events.
  // ---------------------------------------------------------------
  player.on("wmep:mounted", () =>
    console.log("[Host] wmep:mounted -> player is ready"),
  );
  player.on("wmep:unmounted", ({ reason }) =>
    console.log(`[Host] wmep:unmounted -> reason=${reason ?? "(none)"}`),
  );
  player.on("playback:stateChanged", (e) =>
    console.log("[Host] playback:stateChanged:", e),
  );
  player.on("playback:progress", (e) => {
    if (e.percentage % 33 === 0 || e.percentage === 100) {
      console.log("[Host] playback:progress:", e);
    }
  });
  player.on("track:ended", (e) => console.log("[Host] track:ended:", e));

  console.log("-- loadPlaylist pl-1 --");
  await player.capabilities.loadPlaylist({ playlistId: "pl-1" });

  console.log("-- getState (initial) --");
  console.log("[Host]", player.capabilities.getState());

  console.log("-- play trackIndex=0 --");
  await player.capabilities.play({ trackIndex: 0 });
  // Yield to the event loop so the playback session can start.
  await new Promise((r) => setTimeout(r, 30));

  console.log("-- setVolume 0.9 --");
  player.capabilities.setVolume({ volume: 0.9 });
  console.log(
    `[Host] module volume after setVolume: ${player.capabilities.getState().volume}`,
  );

  console.log("-- getState (mid-flight) --");
  console.log("[Host]", player.capabilities.getState());

  await new Promise((r) => setTimeout(r, 200));

  console.log("-- getTrackInfo t-2 --");
  const meta = await player.capabilities.getTrackInfo({ trackId: "t-2" });
  console.log(`[Host] ${meta.title} by ${meta.artist}`);

  console.log("-- addTrack t-4 + notify playlist:updated --");
  await player.capabilities.addTrack({ trackId: "t-4" });
  player.notify("playlist:updated", { playlistId: "pl-1" });
  await new Promise((r) => setTimeout(r, 100));

  console.log("-- play trackIndex=3 --");
  await player.capabilities.play({ trackIndex: 3 });
  await new Promise((r) => setTimeout(r, 200));

  console.log("-- unmount --");
  await player.unmount("demo-finished");

  console.log("\n=== Done ===");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
