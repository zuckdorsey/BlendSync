import { describe, expect, it } from "vitest";
import { buildApplePlaylistCreationPayload } from "../src/apple.js";

describe("buildApplePlaylistCreationPayload", () => {
  it("preserves track order", () => {
    const payload = buildApplePlaylistCreationPayload("Spotify Blend - 2026-05-08", ["a", "b", "c"]);

    expect(payload.relationships.tracks.data).toEqual([
      { id: "a", type: "songs" },
      { id: "b", type: "songs" },
      { id: "c", type: "songs" }
    ]);
  });
});
