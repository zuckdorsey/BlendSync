import { describe, expect, it } from "vitest";
import { normalizeSpotifyItems } from "../src/spotify.js";

describe("normalizeSpotifyItems", () => {
  it("keeps tracks and filters episodes, local files, and null tracks", () => {
    const tracks = normalizeSpotifyItems([
      {
        track: {
          id: "track-1",
          uri: "spotify:track:track-1",
          type: "track",
          is_local: false,
          name: "Song",
          duration_ms: 180000,
          artists: [{ name: "Artist" }],
          album: { name: "Album" },
          external_ids: { isrc: "ISRC1" }
        }
      },
      {
        track: {
          id: "episode-1",
          uri: "spotify:episode:episode-1",
          type: "episode",
          name: "Episode",
          duration_ms: 1000,
          artists: []
        }
      },
      {
        track: {
          id: "local-1",
          uri: "spotify:local:local-1",
          type: "track",
          is_local: true,
          name: "Local",
          duration_ms: 1000,
          artists: []
        }
      },
      { track: null }
    ]);

    expect(tracks).toEqual([
      {
        id: "track-1",
        uri: "spotify:track:track-1",
        name: "Song",
        artists: ["Artist"],
        album: "Album",
        durationMs: 180000,
        isrc: "ISRC1"
      }
    ]);
  });
});
