import { describe, expect, it } from "vitest";
import { chooseBestMetadataMatch } from "../src/matching.js";
import type { SpotifyTrack } from "../src/types.js";

const track: SpotifyTrack = {
  id: "spotify-1",
  uri: "spotify:track:spotify-1",
  name: "Warm Glow",
  artists: ["Nova Lane"],
  album: "Morning Light",
  durationMs: 201000,
  isrc: "US123"
};

describe("chooseBestMetadataMatch", () => {
  it("accepts a strict title artist duration match", () => {
    const match = chooseBestMetadataMatch(track, [
      {
        id: "apple-1",
        name: "Warm Glow",
        artistName: "Nova Lane",
        albumName: "Morning Light",
        durationMs: 202000
      }
    ]);

    expect(match).toEqual({
      status: "matched",
      appleSongId: "apple-1",
      method: "metadata",
      confidence: 1
    });
  });

  it("skips weak matches", () => {
    const match = chooseBestMetadataMatch(track, [
      {
        id: "apple-2",
        name: "Different Song",
        artistName: "Other Artist",
        durationMs: 260000
      }
    ]);

    expect(match).toEqual({
      status: "skipped",
      reason: "No confident Apple Music match found."
    });
  });

  it("skips ambiguous matches", () => {
    const match = chooseBestMetadataMatch(track, [
      {
        id: "apple-1",
        name: "Warm Glow",
        artistName: "Nova Lane",
        albumName: "Morning Light",
        durationMs: 201000
      },
      {
        id: "apple-2",
        name: "Warm Glow",
        artistName: "Nova Lane",
        albumName: "Morning Light",
        durationMs: 201500
      }
    ]);

    expect(match).toEqual({
      status: "skipped",
      reason: "Ambiguous Apple Music match."
    });
  });
});
